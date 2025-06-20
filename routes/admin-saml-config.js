console.log('🔔 /admin/saml-config/generate-cert was called');
const express = require('express');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge'); // Make sure this is installed
const router = express.Router();
const { ensureLoggedIn, ensureAdmin } = require('../middleware/auth');

// Adjust these paths as needed:
const ROOT = path.join(__dirname, '..');
const KEY_PATH = path.join(ROOT, 'key.pem');
const CERT_PATH = path.join(ROOT, 'cert.pem');
const CONFIG_PATH = path.join(ROOT, 'admin', 'saml-config.json');

router.post('/admin/saml-config/saml-generate-cert', ensureLoggedIn, ensureAdmin, (req, res) => {
  try {
    const pki = forge.pki;
    const keys = pki.rsa.generateKeyPair(2048);
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

    const certPem = pki.certificateToPem(cert);
    const keyPem = pki.privateKeyToPem(keys.privateKey);

    fs.writeFileSync(CERT_PATH, certPem);
    fs.writeFileSync(KEY_PATH, keyPem);

    console.log('✅ Cert and key written to disk');

    // Load and update config
    let config = {};
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      config = JSON.parse(raw);
    }

    config.certificate = certPem
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\r?\n|\r/g, '');

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

    req.flash('success', 'New certificate generated and saved.');
    return res.redirect('/admin/saml-config');
  } catch (err) {
    console.error('🔥 Failed to generate cert:', err.stack || err);
    req.flash('error', 'Failed to generate certificate.');
    return res.redirect('/admin/saml-config');
  }
});

module.exports = router;

