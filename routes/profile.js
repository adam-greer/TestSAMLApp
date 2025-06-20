const express = require('express');
const router = express.Router();
const { ensureLoggedIn } = require('../middleware/auth');
const userModel = require('../models/users'); // Updated import

// Show profile edit form
router.get('/', ensureLoggedIn, (req, res) => {
  res.render('profile', { 
    user: req.user, 
    messages: req.flash() 
  });
});

// Handle profile updates
router.post('/', ensureLoggedIn, (req, res) => {
  const { firstName, lastName, displayName, manager, title, email } = req.body;
  
  // Update user in your user store
  const updated = userModel.updateProfile(req.user.username, {
    firstName,
    lastName,
    displayName,
    manager,
    title,
    email
  });
  
  if (updated) {
    // Update session user too
    Object.assign(req.user, { 
      firstName, 
      lastName, 
      displayName, 
      manager, 
      title, 
      email 
    });
    req.flash('success', 'Profile updated successfully.');
  } else {
    req.flash('error', 'Failed to update profile.');
  }
  
  res.redirect('/profile');
});

module.exports = router;

