const express = require('express');
const router = express.Router();
const users = require('../models/users'); // Import your user utility functions
const { ensureLoggedIn, ensureAdmin } = require('../middleware/auth');

// GET /users - List all users (admin only)
router.get('/', ensureLoggedIn, ensureAdmin, (req, res) => {
  try {
    const allUsers = users.getAll();
    res.render('users/list', { 
      title: 'User Management', 
      users: allUsers 
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    req.flash('error', 'Error loading users');
    res.redirect('/');
  }
});

// GET /users/:username - View specific user profile
router.get('/:username', ensureLoggedIn, (req, res) => {
  try {
    const user = users.findByUsername(req.params.username);
    if (!user) {
      return res.status(404).render('error', {
        title: 'User Not Found',
        error: { status: 404, message: 'User not found' }
      });
    }
    
    // Only allow users to view their own profile or admins to view any
    if (req.user.username !== req.params.username && !req.user.isAdmin) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        error: { status: 403, message: 'Access denied' }
      });
    }
    
    res.render('users/profile', { 
      title: `${user.displayName} - Profile`, 
      profileUser: user 
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      error: { status: 500, message: 'Internal server error' }
    });
  }
});

// POST /users/:username/admin - Toggle admin status (admin only)
router.post('/:username/admin', ensureLoggedIn, ensureAdmin, (req, res) => {
  try {
    const { isAdmin } = req.body;
    const success = users.setAdmin(req.params.username, isAdmin === 'true');
    
    if (success) {
      req.flash('success', `Admin status updated for ${req.params.username}`);
    } else {
      req.flash('error', 'User not found');
    }
    
    res.redirect('/users');
  } catch (error) {
    console.error('Error updating admin status:', error);
    req.flash('error', 'Error updating admin status');
    res.redirect('/users');
  }
});

// POST /users/:username/profile - Update user profile (using POST for form compatibility)
router.post('/:username/profile', ensureLoggedIn, (req, res) => {
  try {
    // Only allow users to update their own profile or admins to update any
    if (req.user.username !== req.params.username && !req.user.isAdmin) {
      req.flash('error', 'Access denied');
      return res.redirect('/profile');
    }
    
    const updates = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      displayName: req.body.displayName,
      manager: req.body.manager,
      title: req.body.title,
      email: req.body.email
    };
    
    const success = users.updateProfile(req.params.username, updates);
    
    if (success) {
      req.flash('success', 'Profile updated successfully');
      res.redirect(`/users/${req.params.username}`);
    } else {
      req.flash('error', 'User not found');
      res.redirect('/users');
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    req.flash('error', 'Error updating profile');
    res.redirect(`/users/${req.params.username}`);
  }
});

// API endpoint for AJAX profile updates (if needed)
router.put('/:username/profile', ensureLoggedIn, (req, res) => {
  try {
    // Only allow users to update their own profile or admins to update any
    if (req.user.username !== req.params.username && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updates = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      displayName: req.body.displayName,
      manager: req.body.manager,
      title: req.body.title,
      email: req.body.email
    };
    
    const success = users.updateProfile(req.params.username, updates);
    
    if (success) {
      res.json({ success: true, message: 'Profile updated successfully' });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error updating profile via API:', error);
    res.status(500).json({ error: 'Internal server error' });  
  }
});

module.exports = router;
