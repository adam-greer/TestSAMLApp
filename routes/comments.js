const express = require('express');
const router = express.Router();
const { ensureLoggedIn } = require('../middleware/auth');
const commentsModel = require('../models/comments');

// Show comments page
router.get('/comments', ensureLoggedIn, (req, res, next) => {
  try {
    const comments = commentsModel.loadComments();
    res.render('comments', {
      title: 'Comments',
      user: req.user,
      comments,
      messages: req.flash()
    });
  } catch (err) {
    next(err);
  }
});

// Handle new comment submission
router.post('/comments', ensureLoggedIn, (req, res, next) => {
  try {
    const text = req.body.commentText?.trim();
    if (!text) {
      req.flash('error', 'Comment cannot be empty');
      return res.redirect('/comments');
    }
    commentsModel.addComment(req.user.username, text);
    req.flash('success', 'Comment added!');
    res.redirect('/comments');
  } catch (err) {
    next(err);
  }
});

module.exports = router;

