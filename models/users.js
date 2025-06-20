// models/users.js

// In-memory user store (example)
const localUsers = [
  {
    id: 1,
    username: 'admin',
    passwordHash: '', // or whatever your validatePassword uses
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    isAdmin: true,
    authType: 'local',
    canLoginLocally: true
  },
  // ...other users...
];

/**
 * Find a user by their username.
 */
function findByUsername(username) {
  return localUsers.find(u => u.username === username);
}

function findById(id) {
  return localUsers.find(user => user.id === id);
}


/**
 * (If you need this for passport-local) Validate password.
 * Replace with your real hash check.
 */
function validatePassword(username, password) {
  const user = findByUsername(username);
  return user && password === 'password'; // dummy check
}

/**
 * Return the full list of users.
 */
function getAll() {
  return localUsers;
}

/**
 * Compute simple statistics about your user base.
 */
function getUserStats() {
  const users = getAll();
  return {
    total: users.length,
    admins: users.filter(u => u.isAdmin).length,
    localLogins: users.filter(u => u.canLoginLocally).length,
    samlLogins: users.filter(u => u.authType === 'saml').length,
  };
}

/**
 * Toggle admin flag on a user.
 */
function setAdmin(username, isAdmin) {
  const user = findByUsername(username);
  if (!user) return false;
  user.isAdmin = isAdmin;
  return true;
}

/**
 * Update a user's profile fields.
 */
function updateProfile(username, newData) {
  const user = findByUsername(username);
  if (!user) return false;

  // Update only allowed fields
  if (newData.firstName !== undefined) user.firstName = newData.firstName;
  if (newData.lastName !== undefined) user.lastName = newData.lastName;
  if (newData.email !== undefined) user.email = newData.email;
  if (newData.displayname !== undefined) user.displayname = newData.displayname;
  if (newData.manager !== undefined) user.manager = newData.manager;

  return true;
}

// Export everything you need
module.exports = {
  findByUsername,
  validatePassword,
  getAll,
  getUserStats,
  setAdmin,
  findById,
  updateProfile,
};

