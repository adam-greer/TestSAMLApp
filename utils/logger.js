const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../logs/logs.json');

// Ensure file exists
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, JSON.stringify([]));
}

function logEvent({ type, message, user = 'unknown' }) {
  const logs = JSON.parse(fs.readFileSync(LOG_FILE));
  logs.unshift({
    timestamp: new Date().toISOString(),
    type,
    message,
    user
  });
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

function getLogs() {
  return JSON.parse(fs.readFileSync(LOG_FILE));
}

module.exports = { logEvent, getLogs };

