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

// ✅ New cert generation route
router.post('/admin/saml-generate-cert', ensureLoggedIn, ensureAdmin, (req, res) => {
  const attrs = [{ name: 'commonName', value: 'example.com' }];
  const pems = selfsigned.generate(attrs, { days: 365 });

  // Save PEM files
  fs.writeFileSync(CERT_PATH, pems.cert);
  fs.writeFileSync(KEY_PATH, pems.private);

  // Update saml-config.json
  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {}

  // Strip cert headers/footers/newlines for <X509Certificate>
  config.cert = pems.cert
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\r?\n|\r/g, '');

  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    req.flash('success', 'New SAML certificate generated and config updated.');
  } catch (err) {
    console.error('Failed to save updated SAML config:', err);
    req.flash('error', 'Certificate generated but failed to update config.');
  }

  res.redirect('/admin/saml-config');
});

module.exports = router;

