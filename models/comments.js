// models/comments.js

const fs = require('fs');
const path = require('path');

const COMMENTS_PATH = path.join(__dirname, '..', 'comments.json');

/**
 * Load all comments from disk (or return an empty array if none yet).
 */
function loadComments() {
  try {
    const data = fs.readFileSync(COMMENTS_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // If file doesn’t exist or is invalid, start fresh
    return [];
  }
}

/**
 * Save the given array of comments back to disk.
 */
function saveComments(comments) {
  fs.writeFileSync(COMMENTS_PATH, JSON.stringify(comments, null, 2), 'utf8');
}

/**
 * Add a new comment { user, text, timestamp } to the store.
 */
function addComment(user, text) {
  const comments = loadComments();
  comments.push({
    user,
    text,
    timestamp: new Date().toISOString()
  });
  saveComments(comments);
}

module.exports = {
  loadComments,
  addComment
};

