// models/users.js

// In-memory user store (example)
const localUsers = [
  {
    id: 1,
    username: 'admin',
    passwordHash: 'password', // or whatever your validatePassword uses
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
/* OLD LOGIC
function findById(id) {
  return localUsers.find(user => user.id === Number(id));
   console.log(`findById called with id=${id}, found user:`, user);
}
*/

function findById(id) {
  const user = localUsers.find(user => user.id === Number(id));
  console.log(`findById called with id=${id}, found user:`, user);
  return user;
}


/**
 * (If you need this for passport-local) Validate password.
 * Replace with your real hash check.
 */
function validatePassword(username, password) {
  const user = findByUsername(username);
  if (!user) return false;
  return user.passwordHash === password;  // compare entered password with stored
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


function createUser(newUser) {
  if (findByUsername(newUser.username)) {
    return false; // user already exists
  }

  // You may want to assign a new unique ID
  const maxId = localUsers.reduce((max, u) => u.id > max ? u.id : max, 0);
  newUser.id = maxId + 1; 
  // Set default flags if missing
  if (typeof newUser.isAdmin === 'undefined') newUser.isAdmin = false;
  if (typeof newUser.canLoginLocally === 'undefined') newUser.canLoginLocally = true;
  if (!newUser.authType) newUser.authType = 'local';

  localUsers.push(newUser);
  return newUser;
}

module.exports = {
  // existing exports ...
  createUser,
};



// Export everything you need
module.exports = {
  findByUsername,
  validatePassword,
  getAll,
  getUserStats,
  setAdmin,
  findById,
  updateProfile,
  createUser,
};

