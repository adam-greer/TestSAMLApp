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
    const parsed = JSON.parse(data);
    console.log('[comments.js] Loaded comments:', parsed.length);
    return parsed;
  } catch (err) {
    console.error('[comments.js] Failed to load comments:', err);
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

function saveComments(comments) {
  try {
    fs.writeFileSync(COMMENTS_PATH, JSON.stringify(comments, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save comments:', err);
  }
}


module.exports = {
  loadComments,
  addComment
};

