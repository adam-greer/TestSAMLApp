const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const SamlStrategy = require('passport-saml').Strategy;
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const crypto = require('crypto');
const forge = require('node-forge');

require('dotenv').config(); // Load env vars from .env if present

const config = {
  port: process.env.PORT || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'keyboard cat saml training',
};

// Import middleware functions
const { ensureLoggedIn, ensureAdmin } = require('./middleware/auth');

// Import user model
const users = require('./models/users');
console.log('Users module keys:', Object.keys(users));

const app = express();

// === Config constants ===
const PORT = config.port;
const CONFIG_PATH = path.join(__dirname, 'admin', 'saml-config.json');
const CERT_PATH = path.join(__dirname, 'cert.pem');
const KEY_PATH = path.join(__dirname, 'key.pem');

// === Middleware & View Engine Setup ===
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout');

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));

app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// === Globals for SAML ===
let samlConfig = null;
let samlEnabled = false;
let samlStrategy = null;

// === Passport Local Strategy ===
passport.use(new LocalStrategy((username, password, done) => {
  // Use the user model instead of direct access to localUsers
  const user = users.findByUsername(username);
  if (!user || !users.validatePassword(username, password)) {
    return done(null, false, { message: 'Invalid credentials' });
  }
  return done(null, user);
}));

function setupSamlStrategy() {
  if (!samlConfig) return;
  if (samlStrategy) {
    passport.unuse('saml');
  }
  samlStrategy = new SamlStrategy({
    entryPoint: samlConfig.entryPoint,
    issuer: samlConfig.issuer,
    callbackUrl: samlConfig.callbackUrl,
    cert: samlConfig.cert,
  }, (profile, done) => {
    const user = {
      id: profile.nameID,
      username: profile.nameID,
      email: profile[samlConfig.attributes?.email] || '',
      firstName: profile[samlConfig.attributes?.firstName] || '',
      lastName: profile[samlConfig.attributes?.lastName] || '',
      displayName: profile[samlConfig.attributes?.displayName] || '',
      manager: profile[samlConfig.attributes?.manager] || '',
      title: profile[samlConfig.attributes?.title] || '',
      authType: 'saml',
      samlAssertion: profile._raw || '',
      isAdmin: false,
    };
    return done(null, user);
  });
  passport.use('saml', samlStrategy);
}

// === Load and rebuild SAML config with proper PEM cert ===
function loadSamlConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const cfg = JSON.parse(raw);

    if (cfg.cert) {
      // The cert is stored as base64 string without headers from the router
      let rawCert = cfg.cert;

      // If the cert string does not already contain PEM headers, rebuild it
      if (!rawCert.includes('-----BEGIN CERTIFICATE-----')) {
        rawCert =
          '-----BEGIN CERTIFICATE-----\n' +
          rawCert.match(/.{1,64}/g).join('\n') + // add newlines every 64 chars
          '\n-----END CERTIFICATE-----\n';
      }

      cfg.cert = rawCert; // overwrite with proper PEM for SAML strategy
    } else {
      console.warn('SAML config missing certificate');
    }

    samlConfig = cfg;
    samlEnabled = !!(cfg.cert && cfg.entryPoint && cfg.issuer && cfg.callbackUrl);

    if (samlEnabled) {
      console.log('SAML config loaded, enabling SAML login');
      setupSamlStrategy();
    } else {
      console.warn('SAML config missing required fields or cert, disabling SAML login');
      samlEnabled = false;
    }

  } catch (err) {
    samlEnabled = false;
    console.warn('Failed to load SAML config:', err.message);
  }
}

// === REMOVE THIS ENTIRE SECTION - it conflicts with your router ===
// DELETE FROM HERE:
/*
app.post('/admin/saml/generate-cert', ensureLoggedIn, ensureAdmin, (req, res) => {
  // ... DELETE THIS ENTIRE ENDPOINT
});
*/
// TO HERE (remove the entire endpoint)

// === Keep the rest of your app.js as is ===


// Initial load
loadSamlConfig();

// === Passport Serialization ===
passport.serializeUser((user, done) => {
  done(null, { id: user.id, username: user.username });
});

passport.deserializeUser((obj, done) => {
  // Use the user model to find users
  const user = users.findById(obj.id) || users.findByUsername(obj.username) || obj;
  done(null, user);
});

// === Global Template Variables & Gravatar ===
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.isAdmin = req.user?.isAdmin || false;
  res.locals.messages = req.flash();

  if (req.user && req.user.email) {
    const md5 = crypto.createHash('md5').update(req.user.email.trim().toLowerCase()).digest('hex');
    res.locals.user.avatar = `https://www.gravatar.com/avatar/${md5}?d=identicon`;
  } else if (res.locals.user) {
    res.locals.user.avatar = 'https://www.gravatar.com/avatar?d=identicon';
  }
  next();
});


console.log('=== DEBUGGING ROUTER IMPORTS ===');

// Test each import individually
try {
  const authRouter = require('./routes/auth');
  console.log('✓ authRouter imported successfully, type:', typeof authRouter);
} catch (err) {
  console.log('✗ authRouter import failed:', err.message);
}

try {
  const adminRouter = require('./routes/admin');
  console.log('✓ adminRouter imported successfully, type:', typeof adminRouter);
} catch (err) {
  console.log('✗ adminRouter import failed:', err.message);
}

try {
  const profileRouter = require('./routes/profile');
  console.log('✓ profileRouter imported successfully, type:', typeof profileRouter);
} catch (err) {
  console.log('✗ profileRouter import failed:', err.message);
}

try {
  const usersRouter = require('./routes/userRoutes');
  console.log('✓ usersRouter imported successfully, type:', typeof usersRouter);
} catch (err) {
  console.log('✗ usersRouter import failed:', err.message);
}

try {
  const uploadRouter = require('./routes/upload');
  console.log('✓ uploadRouter imported successfully, type:', typeof uploadRouter);
} catch (err) {
  console.log('✗ uploadRouter import failed:', err.message);
}

console.log('=== END DEBUG ===');

// === Import and Mount Route Modules ===
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const profileRouter = require('./routes/profile');
const usersRouter = require('./routes/userRoutes');
const uploadRouter = require('./routes/upload');
console.log('[DEBUG] Requiring commentsRouter...');
const commentsRouter = require('./routes/comments');
const logoutRouter = require('./routes/logout');
const samlConfigRouter = require('./routes/admin-saml-config');
const samlRouter = require('./routes/saml')(samlConfig);

// Mount routers
app.use('/', authRouter);
app.use('/admin', adminRouter);
app.use('/profile', profileRouter);
app.use('/users', usersRouter);
app.use('/upload', uploadRouter);
app.use('/', commentsRouter);
app.use('/logout', logoutRouter);
app.use('/admin', samlConfigRouter);
app.use('/admin/saml-config', samlConfigRouter);
app.use('/saml', samlRouter);

// === Error Handling Middleware (Must be last) ===
// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    error: { status: 404, message: 'Page not found' }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).render('error', {
    title: 'Error',
    error: process.env.NODE_ENV === 'development' ? err : { message: 'Something went wrong!' }
  });
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`TestSAMLApp running on http://localhost:${PORT}`);
});

// Export for testing or other modules
module.exports = app;
