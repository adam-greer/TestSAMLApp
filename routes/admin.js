const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
// Import middleware from the separate middleware file
const { ensureAdmin } = require('../middleware/auth');
// Import user management functions from the model layer
const userModel = require('../models/users');

const logFilePath = path.join(__dirname, '..', 'logs', 'logs.json');

// Admin dashboard page
router.get('/', ensureAdmin, (req, res) => {
  res.render('admin', {
    title: 'Admin Panel',
    user: req.user,
    isAdmin: req.user.isAdmin,
    messages: req.flash()
  });
});

// System logs page
router.get('/logs', ensureAdmin, (req, res, next) => {
  console.log('User:', req.user);
  console.log('Reading log file from:', logFilePath);
  
  // Ensure logs directory exists
  const logsDir = path.dirname(logFilePath);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Create empty logs file if it doesn't exist
  if (!fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, JSON.stringify([]));
  }
  
  fs.readFile(logFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading log file:', err.stack || err);
      return next(err);
    }
    
    console.log('Log file read successful');
    let logs = [];
    try {
      logs = JSON.parse(data);
    } catch (parseErr) {
      console.error('Error parsing log JSON:', parseErr);
      // Continue with empty logs array
    }
    
    res.render('admin-logs', {
      title: 'System Logs',
      user: req.user,
      isAdmin: req.user.isAdmin,
      logs: logs,
      messages: req.flash()
    });
  });
});

// Clear logs
router.post('/logs/clear', ensureAdmin, (req, res) => {
  try {
    fs.writeFileSync(logFilePath, JSON.stringify([]));
    req.flash('success', 'Logs cleared successfully');
  } catch (err) {
    console.error('Error clearing logs:', err);
    req.flash('error', 'Failed to clear logs');
  }
  res.redirect('/admin/logs');
});

// User management page
router.get('/users', ensureAdmin, (req, res) => {
  const allUsers = userModel.getAll();
  const stats = userModel.getUserStats();
  res.render('admin-users', {
    title: 'User Management',
    user: req.user,
    isAdmin: req.user.isAdmin,
    users: allUsers,
    stats: stats,
    messages: req.flash()
  });
});


// Admin edit user form

router.get('/users/edit/:id', ensureAdmin, (req, res) => {
  const id = Number(req.params.id);
  const targetUser = userModel.findById(id);

  if (!targetUser) {
    return res.status(404).render('error', {
      title: 'User Not Found',
      error: { status: 404, message: 'User not found' }
    });
  }
  console.log(targetUser);
  res.render('admin-users-edit', {
    title: `Edit User: ${targetUser.username}`,
    user: req.user,
    isAdmin: req.user.isAdmin,
    editUser: targetUser,
    messages: req.flash()
  });
});


// update edited users fields

router.post('/users/edit/:username', ensureAdmin, (req, res) => {
  const targetUser = userModel.findByUsername(req.params.username);

  if (!targetUser) {
    req.flash('error', 'User not found');
    return res.redirect('/admin/users');
  }

  // Update allowed fields
  targetUser.firstName = req.body.firstName || targetUser.firstName;
  targetUser.lastName = req.body.lastName || targetUser.lastName;
  targetUser.displayName = req.body.displayName || targetUser.displayName;
  targetUser.email = req.body.email || targetUser.email;

  req.flash('success', 'User updated successfully');
  res.redirect('/admin/users');
});


// Toggle admin status for a user
router.post('/users/:username/toggle-admin', ensureAdmin, (req, res) => {
  const { username } = req.params;
  const targetUser = userModel.findByUsername(username);
  
  // Prevent removing admin from yourself
  if (username === req.user.username) {
    req.flash('error', 'You cannot change your own admin status');
    return res.redirect('/admin/users');
  }
  
  if (targetUser) {
    const success = userModel.setAdmin(username, !targetUser.isAdmin);
    if (success) {
      const status = targetUser.isAdmin ? 'removed from' : 'granted';
      req.flash('success', `Admin privileges ${status} ${username}`);
    } else {
      req.flash('error', 'Failed to update admin status');
    }
  } else {
    req.flash('error', 'User not found');
  }
  
  res.redirect('/admin/users');
});

// Test page
router.get('/test', ensureAdmin, (req, res) => {
  res.render('test', {
    title: 'Test Page',
    user: req.user,
    isAdmin: req.user.isAdmin,
    message: 'If you see this, rendering works!',
    messages: req.flash()
  });
});

module.exports = router;
