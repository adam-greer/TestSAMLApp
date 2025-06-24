const express = require('express');

// Try different import approaches
let generateServiceProviderMetadata;

try {
  generateServiceProviderMetadata = require('passport-saml-metadata');
} catch (err) {
  console.log('Direct require failed:', err.message);
}

if (!generateServiceProviderMetadata || typeof generateServiceProviderMetadata !== 'function') {
  try {
    const { generateServiceProviderMetadata: genSPMetadata } = require('passport-saml-metadata');
    generateServiceProviderMetadata = genSPMetadata;
  } catch (err) {
    console.log('Destructuring failed:', err.message);
  }
}

if (!generateServiceProviderMetadata || typeof generateServiceProviderMetadata !== 'function') {
  try {
    const mod = require('passport-saml-metadata');
    generateServiceProviderMetadata = mod.default;
  } catch (err) {
    console.log('Default property failed:', err.message);
  }
}

module.exports = function (samlConfig) {
  const router = express.Router();

  router.get('/metadata', (req, res) => {
    if (!samlConfig || !samlConfig.cert || !samlConfig.callbackUrl) {
      return res.status(500).send('SAML not configured');
    }

    if (!generateServiceProviderMetadata || typeof generateServiceProviderMetadata !== 'function') {
      console.error('No valid metadata generator function found');

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

// Manual fallback metadata generator
function generateManualMetadata(samlConfig) {
  const certPem = samlConfig.cert.includes('BEGIN CERTIFICATE')
    ? samlConfig.cert
    : `-----BEGIN CERTIFICATE-----\n${samlConfig.cert.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;

  const certData = certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\n/g, '');

  const entityId = samlConfig.entityId || samlConfig.callbackUrl;
  const callbackUrl = samlConfig.callbackUrl;

  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
                     entityID="${xmlEscape(entityId)}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${certData}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                 Location="${xmlEscape(callbackUrl)}"
                                 index="1" />
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
}

function xmlEscape(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

