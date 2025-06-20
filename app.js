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
const mod = require('passport-saml-metadata');
const generateServiceProviderMetadata = mod.default || mod;
console.log('generateServiceProviderMetadata is a function:', typeof generateServiceProviderMetadata === 'function');


require('dotenv').config(); // Load env vars from .env if present

const config = {
  port: process.env.PORT || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'keyboard cat saml training',
};

// Import middleware functions
const { ensureLoggedIn, ensureAdmin } = require('./middleware/auth');

// Import user model
const users = require('./models/users');

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

app.use((req, res, next) => {
  res.locals.title = 'MyApp'; // default title
  next();
});


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


// === Load SAML Config & Setup Strategy ===
function loadSamlConfig() {
  try {
    // Ensure admin directory exists
    const adminDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(adminDir)) {
      fs.mkdirSync(adminDir, { recursive: true });
    }

    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const cfg = JSON.parse(raw);
    if (cfg.cert && cfg.entryPoint && cfg.issuer && cfg.callbackUrl) {
      samlEnabled = true;
      samlConfig = cfg;
      console.log('SAML config loaded, SAML login enabled');
      setupSamlStrategy();
    } else {
      samlEnabled = false;
      console.warn('SAML config missing required fields or cert, SAML login disabled');
    }
  } catch (err) {
    samlEnabled = false;
    console.warn('Could not load SAML config, SAML login disabled:', err.message);
  }
}

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

loadSamlConfig();


const samlRouter = require('./routes/saml')(samlConfig);
app.use('/saml', samlRouter);

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

// === SAML Metadata Route (Before other routes) ===

app.get('/saml/metadata', (req, res) => {
  if (!samlConfig || !samlConfig.cert) {
    return res.status(500).send('SAML not configured');
  }

  try {
    const metadata = generateServiceProviderMetadata(
      samlConfig.callbackUrl,
      samlConfig.cert
    );
    res.type('application/xml').send(metadata);
  } catch (err) {
    console.error('Failed to generate SP metadata:', err);
    res.status(500).send('Failed to generate SP metadata');
  }
});



// === Admin: SAML Config Editor ===
app.get('/admin/saml-config', ensureLoggedIn, ensureAdmin, (req, res) => {
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

app.post('/admin/saml-config', ensureLoggedIn, ensureAdmin, (req, res) => {
  const configPath = path.join(__dirname, 'admin', 'saml-config.json');

  // Load current config or default empty
  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {}

  // Update the attributes key from the form
  if (req.body.attributes) {
    config.attributes = req.body.attributes;
  }

  // Optionally update other config fields here as needed

  // Write back the updated config
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    req.flash('success', 'SAML configuration updated successfully.');
  } catch (err) {
    req.flash('error', 'Failed to save config: ' + err.message);
  }

  res.redirect('/admin/saml-config');
});

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

// === SAML Metadata Route (Before other routes) ===

app.get('/saml/metadata', (req, res) => {
  if (!samlConfig || !samlConfig.cert) {
    return res.status(500).send('SAML not configured');
  }

  try {
    const metadata = generateServiceProviderMetadata(
      samlConfig.callbackUrl,
      samlConfig.cert
    );
    res.type('application/xml').send(metadata);
  } catch (err) {
    console.error('Failed to generate SP metadata:', err);
    res.status(500).send('Failed to generate SP metadata');
  }
});



// === Admin: SAML Config Editor ===
app.get('/admin/saml-config', ensureLoggedIn, ensureAdmin, (req, res) => {
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

app.post('/admin/saml-config', ensureLoggedIn, ensureAdmin, (req, res) => {
  const configPath = path.join(__dirname, 'admin', 'saml-config.json');
  
  // Load current config or default empty
  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {}

  // Update the attributes key from the form
  if (req.body.attributes) {
    config.attributes = req.body.attributes;
  }

  // Optionally update other config fields here as needed

  // Write back the updated config
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    req.flash('success', 'SAML configuration updated successfully.');
  } catch (err) {
    req.flash('error', 'Failed to save config: ' + err.message);
  }

  res.redirect('/admin/saml-config');
});


// === Admin: Generate Cert + Key ===
app.post('/admin/saml/generate-cert', ensureLoggedIn, ensureAdmin, (req, res) => {
  try {
    const pki = forge.pki;
    const keys = pki.rsa.generateKeyPair(2048);
    const cert = pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);

    const attrs = [{ name: 'commonName', value: 'TestSAMLApp' }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey);

    const certPem = pki.certificateToPem(cert);
    const keyPem = pki.privateKeyToPem(keys.privateKey);

    fs.writeFileSync(CERT_PATH, certPem);
    fs.writeFileSync(KEY_PATH, keyPem);

    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    config.cert = certPem;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

    loadSamlConfig(); // reload config after updating cert
    req.flash('success', 'Certificate generated and saved successfully.');
    res.redirect('/admin/saml-config');
  } catch (err) {
    console.error('Error generating cert:', err);
    req.flash('error', 'Failed to generate certificate: ' + err.message);
    res.redirect('/admin/saml-config');
  }
});

console.log('=== DEBUGGING ROUTER IMPORTS ===');

// Test each import individually
try {
  const authRouter = require('./routes/auth');
  console.log('✓ authRouter imported successfully, type:', typeof authRouter);
  console.log('  - isFunction:', typeof authRouter === 'function');
  console.log('  - constructor:', authRouter.constructor?.name);
} catch (err) {
  console.log('✗ authRouter import failed:', err.message);
}

try {
  const adminRouter = require('./routes/admin');
  console.log('✓ adminRouter imported successfully, type:', typeof adminRouter);
  console.log('  - isFunction:', typeof adminRouter === 'function');
  console.log('  - constructor:', adminRouter.constructor?.name);
} catch (err) {
  console.log('✗ adminRouter import failed:', err.message);
}

try {
  const profileRouter = require('./routes/profile');
  console.log('✓ profileRouter imported successfully, type:', typeof profileRouter);
  console.log('  - isFunction:', typeof profileRouter === 'function');
  console.log('  - constructor:', profileRouter.constructor?.name);
} catch (err) {
  console.log('✗ profileRouter import failed:', err.message);
}

try {
  const usersRouter = require('./routes/userRoutes');
  console.log('✓ usersRouter imported successfully, type:', typeof usersRouter);
  console.log('  - isFunction:', typeof usersRouter === 'function');
  console.log('  - constructor:', usersRouter.constructor?.name);
} catch (err) {
  console.log('✗ usersRouter import failed:', err.message);
}

try {
  const uploadRouter = require('./routes/upload');
  console.log('✓ uploadRouter imported successfully, type:', typeof uploadRouter);
  console.log('  - isFunction:', typeof uploadRouter === 'function');
  console.log('  - constructor:', uploadRouter.constructor?.name);
} catch (err) {
  console.log('✗ uploadRouter import failed:', err.message);
}

console.log('=== END DEBUG ===');

// === Import and Mount Route Modules ===
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const profileRouter = require('./routes/profile');
const usersRouter = require('./routes/userRoutes'); // This should now work properly
const uploadRouter = require('./routes/upload');
const commentsRouter = require('./routes/comments');

// Mount routers
app.use('/', authRouter);
app.use('/admin', adminRouter);
app.use('/profile', profileRouter);
app.use('/users', usersRouter); // This line should now work without errors
app.use('/upload', uploadRouter);
app.use('/', commentsRouter);

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
