function ensureLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

function ensureAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user?.isAdmin) return next();
  res.status(403).send('Forbidden - Admins only');
}

module.exports = { ensureLoggedIn, ensureAdmin };
