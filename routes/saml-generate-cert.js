const express = require('express');
const fs = require('fs');
const path = require('path');
const { ensureLoggedIn, ensureAdmin } = require('../middleware/auth');
const selfsigned = require('selfsigned');
const router = express.Router();

const CONFIG_PATH = path.join(__dirname, '..', 'saml-config.json');
const CERT_PATH = path.join(__dirname, '..', 'cert.pem');
const KEY_PATH = path.join(__dirname, '..', 'key.pem');

// GET SAML Config Editor
router.get('/admin/saml-config', ensureLoggedIn, ensureAdmin, (req, res) => {
  let configText = '{}';
  let configObj = {};
  try {
    configText = fs.readFileSync(CONFIG_PATH, 'utf-8');
    configObj = JSON.parse(configText);
  } catch {
    configText = '{}';
    configObj = {};
  }
  res.render('admin-saml-config', {
    title: 'Edit SAML Config',
    configText,
    config: configObj,
    messages: req.flash()
  });
});

// Fixed cert generation route
router.post('/admin/saml-generate-cert', ensureLoggedIn, ensureAdmin, (req, res) => {
  try {
    // Generate certificate with proper attributes
    const attrs = [
      { name: 'commonName', value: req.body.commonName || 'TestSAMLApp' },
      { name: 'countryName', value: 'US' },
      { name: 'organizationName', value: 'Test Organization' }
    ];
    
    const options = {
      days: 730, // 2 years
      keySize: 2048,
      algorithm: 'sha256'
    };
    
    const pems = selfsigned.generate(attrs, options);
    
    // Save PEM files to disk
    fs.writeFileSync(CERT_PATH, pems.cert);
    fs.writeFileSync(KEY_PATH, pems.private);
    
    // Load existing SAML config
    let config = {};
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      console.log('🔍 Config before update:', Object.keys(config));
    } catch (err) {
      console.warn('Could not load existing config, creating new one:', err.message);
      config = {
        entryPoint: "",
        issuer: "",
        callbackUrl: "",
        attributes: {}
      };
    }
    
    // Remove any existing duplicate certificate fields
    if (config.certificate) {
      console.log('🗑️ Removing duplicate certificate field');
      delete config.certificate;
    }
    if (config.certificateForMetadata) {
      console.log('🗑️ Removing certificateForMetadata field');
      delete config.certificateForMetadata;
    }
    
    // Update ONLY the cert field with full PEM certificate
    console.log('✅ Updating cert field with new certificate');
    config.cert = pems.cert;
    
    console.log('🔍 Config after update:', Object.keys(config));
    
    // Save updated config
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    
    req.flash('success', `New SAML certificate generated successfully! 
      Certificate expires: ${new Date(Date.now() + (730 * 24 * 60 * 60 * 1000)).toDateString()}`);
    
  } catch (err) {
    console.error('Certificate generation failed:', err);
    req.flash('error', `Failed to generate certificate: ${err.message}`);
  }
  
  res.redirect('/admin/saml-config');
});

// New route to get certificate info for metadata
router.get('/admin/saml-metadata', ensureLoggedIn, ensureAdmin, (req, res) => {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    
    // Generate SAML metadata XML
    const metadata = generateSAMLMetadata(config);
    
    res.set('Content-Type', 'application/xml');
    res.send(metadata);
  } catch (err) {
    console.error('Failed to generate metadata:', err);
    res.status(500).send('Failed to generate SAML metadata');
  }
});

// Helper function to generate SAML metadata
function generateSAMLMetadata(config) {
  const certForMetadata = config.certificateForMetadata || 
    (config.cert ? config.cert
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\r?\n|\r/g, '') : '');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" 
                     entityID="${config.issuer || 'your-app-identifier'}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${certForMetadata}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:KeyDescriptor use="encryption">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${certForMetadata}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" 
                           Location="${config.callbackUrl || 'http://website/login/callback'}/slo"/>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" 
                                Location="${config.callbackUrl || 'http://website/login/callback'}" 
                                index="0" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
}

module.exports = router;
