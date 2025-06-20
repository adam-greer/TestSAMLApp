const localUsers = [
  {
    id: 1,
    username: 'admin',
    password: 'password', // plaintext for now; later can migrate to hashes
    displayName: 'Admin User',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    manager: '',
    title: 'Administrator',
    isAdmin: true,
    authType: 'local',
    canLoginLocally: true
    // Add other fields as needed
  }
];

// Find user by username
function findByUsername(username) {
  return localUsers.find(u => u.username === username);
}

// Find user by id
function findById(id) {
  return localUsers.find(u => u.id === id);
}

// Validate password for username
function validatePassword(username, password) {
  const user = findByUsername(username);
  if (!user) return false;
  return user.password === password;
}

// Get all users (for admin user list page)
function getAll() {
  return localUsers;
}

// Set or unset admin flag on a user
function setAdmin(username, isAdmin) {
  const user = findByUsername(username);
  if (!user) return false;
  user.isAdmin = isAdmin;
  return true;
}

// Update user profile
function updateProfile(username, updates) {
  const user = findByUsername(username);
  if (!user) return false;
  
  // Update the user object with the provided fields
  if (updates.firstName !== undefined) user.firstName = updates.firstName;
  if (updates.lastName !== undefined) user.lastName = updates.lastName;
  if (updates.displayName !== undefined) user.displayName = updates.displayName;
  if (updates.manager !== undefined) user.manager = updates.manager;
  if (updates.title !== undefined) user.title = updates.title;
  if (updates.email !== undefined) user.email = updates.email;
  
  return true; // Return true to indicate success
}

// Add a new user (for future use)
function addUser(userData) {
  const newId = Math.max(...localUsers.map(u => u.id)) + 1;
  const newUser = {
    id: newId,
    username: userData.username,
    password: userData.password,
    displayName: userData.displayName || userData.username,
    firstName: userData.firstName || '',
    lastName: userData.lastName || '',
    email: userData.email || '',
    manager: userData.manager || '',
    title: userData.title || '',
    isAdmin: userData.isAdmin || false,
    authType: userData.authType || 'local',
    canLoginLocally: userData.canLoginLocally !== undefined ? userData.canLoginLocally : true
  };
  
  localUsers.push(newUser);
  return newUser;
}

module.exports = {
  findByUsername,
  findById,
  validatePassword,
  getAll,
  setAdmin,
  updateProfile,
  addUser
};
