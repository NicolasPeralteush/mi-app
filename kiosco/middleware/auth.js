function isAuthenticated(req, res, next) {
    if (req.session && req.session.usuario) {
        return next();
    }
    req.session.returnTo = req.originalUrl;
    res.redirect('/kiosco/login');
}

function isAdmin(req, res, next) {
    if (req.session && req.session.usuario && req.session.usuario.rol === 'admin') {
        return next();
    }
    res.status(403).render('kiosco/error', {
        mensaje: 'Acceso denegado. Se requieren permisos de administrador.'
    });
}

module.exports = { isAuthenticated, isAdmin };
