// src/middlewares/authMiddleware.js

function checkAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    // No logueado => redirige a /login
    return res.redirect('/login');
  }
  next();
}

/**
 * allowedRoles = ['Administrador', 'Compras', 'OtroRol']
 *
 * Ejemplo de uso en rutas:
 *    router.get('/algo', checkAuth, checkRole(['Administrador']), (req, res) => { ... });
 */
function checkRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.redirect('/login');
    }

    // roles del usuario según tu modelo de sesión
    const userRoles = [
      req.session.user.role,
      req.session.user.role1,
      req.session.user.role2,
      req.session.user.role3
    ];

    // Verificamos si alguno de los roles del usuario está en allowedRoles
    const hasAccess = userRoles.some(role => allowedRoles.includes(role));

    if (!hasAccess) {
      return res.status(403).send('No tienes permiso para acceder');
    }

    next();
  };
}

module.exports = {
  checkAuth,
  checkRole
};
