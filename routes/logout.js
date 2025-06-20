const express = require('express');
const router = express.Router();

router.get('/', (req, res, next) => {
  // Passport logout
  if (req.isAuthenticated && req.isAuthenticated()) {
    req.logout(function(err) {
      if (err) { return next(err); }
      req.flash('success', 'You have been logged out.');
      return res.redirect('/login'); // or wherever you want after logout
    });
  } else {
    // Just redirect if not logged in
    res.redirect('/login');
  }
});

module.exports = router;

