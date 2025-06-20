const express = require('express');
const router = express.Router();
const { ensureLoggedIn } = require('../middleware/auth');
const commentsModel = require('../models/comments');
console.log('[comments.js] comments router loaded');

// Show comments page

router.get('/comments', ensureLoggedIn, (req, res, next) => {
  console.log('[GET /comments] Hanlder called');
  try {
    const comments = commentsModel.loadComments();
    console.log(`[GET /comments] Loaded comments: ${comments.length}`);
    res.render('comments', {
      title: 'Comments',
      user: req.user,
      comments,
      messages: req.flash()
    }, (err, html) => {
      if (err) {
        console.error('[Render Error]:', err);
        return next(err);
      }
      res.send(html);
    });

  } catch (err) {
    console.error('[GET /comments] Error:', err);
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

