const express = require('express');

// Try different import approaches
let generateServiceProviderMetadata;

try {
  // Approach 1: Direct require
  generateServiceProviderMetadata = require('passport-saml-metadata');
} catch (err) {
  console.log('Direct require failed:', err.message);
}

if (!generateServiceProviderMetadata || typeof generateServiceProviderMetadata !== 'function') {
  try {
    // Approach 2: Destructuring
    const { generateServiceProviderMetadata: genSPMetadata } = require('passport-saml-metadata');
    generateServiceProviderMetadata = genSPMetadata;
  } catch (err) {
    console.log('Destructuring failed:', err.message);
  }
}

if (!generateServiceProviderMetadata || typeof generateServiceProviderMetadata !== 'function') {
  try {
    // Approach 3: Check for .default property
    const mod = require('passport-saml-metadata');
    generateServiceProviderMetadata = mod.default;
  } catch (err) {
    console.log('Default property failed:', err.message);
  }
}

// Alternative: Use a different SAML metadata library
// If passport-saml-metadata doesn't work, try using passport-saml directly
// or another SAML library like saml2-js

module.exports = function(samlConfig) {
  const router = express.Router();
  
  router.get('/metadata', (req, res) => {
    if (!samlConfig || !samlConfig.cert || !samlConfig.callbackUrl) {
      return res.status(500).send('SAML not configured');
    }
    
    // If no function is available, try manual metadata generation
    if (!generateServiceProviderMetadata || typeof generateServiceProviderMetadata !== 'function') {
      console.error('No valid metadata generator function found');
      
      // Manual metadata generation as fallback
      try {
        const metadata = generateManualMetadata(samlConfig);
        res.type('application/xml').send(metadata);
        return;
      } catch (err) {
        console.error('Manual metadata generation failed:', err);
        return res.status(500).send('Failed to generate SP metadata');
      }
    }
    
    try {
      const certPem = samlConfig.cert.includes('BEGIN CERTIFICATE')
        ? samlConfig.cert
        : `-----BEGIN CERTIFICATE-----\n${samlConfig.cert.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;
      
      const metadata = generateServiceProviderMetadata(
        samlConfig.callbackUrl,
        certPem
      );
      
      res.type('application/xml').send(metadata);
    } catch (err) {
      console.error('Failed to generate SP metadata:', err);
      res.status(500).send('Failed to generate SP metadata');
    }
  });
  
  return router;
};

// Fallback manual metadata generation
function generateManualMetadata(samlConfig) {
  const certPem = samlConfig.cert.includes('BEGIN CERTIFICATE')
    ? samlConfig.cert
    : `-----BEGIN CERTIFICATE-----\n${samlConfig.cert.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;
  
  // Remove PEM headers and format certificate for XML
  const certData = certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\n/g, '');
  
  const entityId = samlConfig.entityId || samlConfig.callbackUrl;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" 
                     entityID="${entityId}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${certData}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" 
                                 Location="${samlConfig.callbackUrl}" 
                                 index="1" />
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
}
