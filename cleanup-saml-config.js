// cleanup-saml-config.js
// Run this once to clean up your saml-config.json file

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'saml-config.json');

try {
  // Read current config
  const configText = fs.readFileSync(CONFIG_PATH, 'utf8');
  const config = JSON.parse(configText);
  
  console.log('Current config keys:', Object.keys(config));
  
  // Remove the problematic 'certificate' field
  if (config.certificate) {
    console.log('Found duplicate "certificate" field, removing it...');
    delete config.certificate;
  }
  
  // Remove any other duplicate certificate fields
  if (config.certificateForMetadata) {
    console.log('Found "certificateForMetadata" field, removing it...');
    delete config.certificateForMetadata;
  }
  
  // Ensure we have the proper structure
  const cleanConfig = {
    entryPoint: config.entryPoint || "",
    issuer: config.issuer || "",
    callbackUrl: config.callbackUrl || "",
    cert: config.cert || "",
    attributes: config.attributes || {}
  };
  
  // Write cleaned config back
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cleanConfig, null, 2), 'utf8');
  
  console.log('✅ Config cleaned successfully!');
  console.log('Clean config keys:', Object.keys(cleanConfig));
  
} catch (err) {
  console.error('❌ Error cleaning config:', err.message);
}
