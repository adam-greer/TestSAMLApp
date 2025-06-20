const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, 'admin', 'saml-config.json');

function getConfig() {
  if (!fs.existsSync(configPath)) {
    return null;
  }
  const raw = fs.readFileSync(configPath);
  return JSON.parse(raw);
}

function saveConfig(newConfig) {
  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
}

module.exports = { getConfig, saveConfig };

