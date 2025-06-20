// routes/auth.js - Authentication routes
const express = require('express');
const passport = require('passport');
const { ensureLoggedIn } = require('../middleware/auth');
const router = express.Router();

// Home page
router.get('/', (req, res) => {
  res.render('index', { title: 'Home' });
});

// Login page
router.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/profile');
  }
  res.render('login', { 
    title: 'Login',
    samlEnabled: process.env.SAML_ENABLED === 'true'
  });
});

// Local login POST
router.post('/login', passport.authenticate('local', {
  successRedirect: '/profile',
  failureRedirect: '/login',
  failureFlash: true
}));

// SAML login initiation
router.get('/login/saml', passport.authenticate('saml'));

// SAML callback
router.post('/login/callback', passport.authenticate('saml', {
  successRedirect: '/profile',
  failureRedirect: '/login',
  failureFlash: true
}));

// Logout
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect('/');
  });
});

module.exports = router;
