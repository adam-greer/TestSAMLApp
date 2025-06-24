console.log('🔔 admin-saml-config router loading');
const express = require('express');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const router = express.Router();
console.log('✅ Router created successfully');
const { ensureLoggedIn, ensureAdmin } = require('../middleware/auth');

// Adjust these paths as needed:
const ROOT = path.join(__dirname, '..');
const KEY_PATH = path.join(ROOT, 'key.pem');
const CERT_PATH = path.join(ROOT, 'cert.pem');
const CONFIG_PATH = path.join(ROOT, 'admin', 'saml-config.json');

console.log('📁 Router paths:');
console.log('  ROOT:', ROOT);
console.log('  KEY_PATH:', KEY_PATH);
console.log('  CERT_PATH:', CERT_PATH);
console.log('  CONFIG_PATH:', CONFIG_PATH);

// Update your GET route to provide the data the view expects
router.get('/', ensureLoggedIn, ensureAdmin, (req, res) => {
  console.log('🎯 GET / route hit in admin-saml-config router');
  console.log('Request URL:', req.url);
  console.log('Request path:', req.path);
  console.log('Original URL:', req.originalUrl);
  console.log('🔔 SAML config page requested');
  
  try {
    // Load existing config if it exists
    let config = {};
    let configText = '';
    
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      console.log('📄 Raw file contents:', raw); // ADD THIS LINE
      config = JSON.parse(raw);
      console.log('📋 Parsed config keys:', Object.keys(config)); // ADD THIS LINE
      console.log('🔍 Config object:', JSON.stringify(config, null, 2)); // ADD THIS LINE
      configText = JSON.stringify(config, null, 2); // Pretty formatted JSON
      console.log('📋 Loaded config with keys:', Object.keys(config));
    } else {
      // Default empty config
      configText = JSON.stringify({
        entryPoint: '',
        issuer: '',
        callbackUrl: '',
        cert: '',
        tenantId: ''
      }, null, 2);
    }
    console.log('📝 Final configText being sent to view:', configText); // ADD THIS LINE

    // Render the SAML config page with the expected data
    res.render('admin-saml-config', { 
      title: 'SAML Configuration',
      config: config,
      configText: configText
    });
    
  } catch (err) {
    console.error('❌ Error loading SAML config page:', err);
    req.flash('error', 'Error loading SAML configuration');
    res.redirect('/admin');
  }
});

// Add POST route to handle the form submission (matches your view's form action)
router.post('/', ensureLoggedIn, ensureAdmin, (req, res) => {
  console.log('🔔 SAML config save requested');
  
  try {
    const configText = req.body.configText;
    
    // Parse the JSON from the textarea
    const config = JSON.parse(configText);
    
    // Ensure admin directory exists
    const adminDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(adminDir)) {
      fs.mkdirSync(adminDir, { recursive: true });
    }
    
    // Save config
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    
    req.flash('success', 'SAML configuration saved successfully');
    res.redirect('/admin/saml-config');
    
  } catch (err) {
    console.error('❌ Error saving SAML config:', err);
    req.flash('error', 'Error saving SAML configuration: ' + err.message);
    res.redirect('/admin/saml-config');
  }
});

router.post('/saml-generate-cert', ensureLoggedIn, ensureAdmin, (req, res) => {
  console.log('🔔 Certificate generation endpoint called');
  console.log('Request method:', req.method);
  console.log('Request path:', req.path);
  console.log('Request URL:', req.url);

  try {
    console.log('🔧 Starting certificate generation...');
    const pki = forge.pki;
    const keys = pki.rsa.generateKeyPair(2048);
    console.log('✅ RSA key pair generated');

    const cert = pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 5);

    const attrs = [{ name: 'commonName', value: 'Test SAML Cert' }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey);
    console.log('✅ Certificate created and signed');

    const certPem = pki.certificateToPem(cert);
    const keyPem = pki.privateKeyToPem(keys.privateKey);

    console.log('📄 Certificate PEM length:', certPem.length);
    console.log('📄 Key PEM length:', keyPem.length);

    // Write cert and key files
    fs.writeFileSync(CERT_PATH, certPem);
    fs.writeFileSync(KEY_PATH, keyPem);
    console.log('✅ Cert and key written to disk');

    // Load and update config
    let config = {};
    if (fs.existsSync(CONFIG_PATH)) {
      console.log('📄 Loading existing config from:', CONFIG_PATH);
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      config = JSON.parse(raw);
      console.log('📋 Existing config keys:', Object.keys(config));
    } else {
      console.log('📄 Creating new config file');
      const adminDir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(adminDir)) {
        console.log('📁 Creating admin directory:', adminDir);
        fs.mkdirSync(adminDir, { recursive: true });
      }
    }

    const certBase64 = certPem
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\r?\n|\r/g, '');

    console.log('🔐 Certificate base64 length:', certBase64.length);
    config.cert = certBase64;

    const configJson = JSON.stringify(config, null, 2);
    console.log('📄 Writing config, length:', configJson.length);
    fs.writeFileSync(CONFIG_PATH, configJson, 'utf8');
    console.log('✅ Config written successfully');

    req.flash('success', 'New certificate generated and saved.');
    console.log('✅ Certificate generation completed successfully');
    return res.redirect('/admin/saml-config');

  } catch (err) {
    console.error('❌ Certificate generation failed:', err.message);
    console.error('❌ Full error:', err);
    console.error('❌ Stack trace:', err.stack);
    
    // Send error response instead of redirect to see the actual error
    return res.status(500).json({ 
      error: err.message, 
      stack: err.stack 
    });
  }
});

// Add a test route to check if the router is working
router.get('/test', (req, res) => {
  console.log('🧪 Test route called');
  res.json({ message: 'Router is working', timestamp: new Date().toISOString() });
});

console.log('✅ admin-saml-config router configured and exported');
module.exports = router;
