const bcrypt = require('bcrypt');
const db = require('../config/db');
const Auditoria = require('../models/Auditoria');

const authController = {
    async loginForm(req, res) {
        if (req.session && req.session.usuario) {
            return res.redirect('/kiosco');
        }
        res.render('kiosco/login', { error: null });
    },

    async login(req, res) {
        const { usuario, password } = req.body;
        if (!usuario || !password) {
            return res.render('kiosco/login', { error: 'Usuario y contraseña requeridos' });
        }
        try {
            const users = await db.query(
                'SELECT id, usuario, password, nombre, rol, activo FROM ksc_usuarios WHERE usuario = ?',
                [usuario]
            );
            if (users.length === 0) {
                return res.render('kiosco/login', { error: 'Credenciales inválidas' });
            }
            const user = users[0];
            if (!user.activo) {
                return res.render('kiosco/login', { error: 'Usuario desactivado' });
            }
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                return res.render('kiosco/login', { error: 'Credenciales inválidas' });
            }
            req.session.usuario = {
                id: user.id,
                usuario: user.usuario,
                nombre: user.nombre,
                rol: user.rol
            };
            await db.query('UPDATE ksc_usuarios SET ultimo_acceso = NOW() WHERE id = ?', [user.id]);
            await Auditoria.registrar(user.id, 'login', 'Inicio de sesión', req.ip);
            const returnTo = req.session.returnTo || '/kiosco';
            delete req.session.returnTo;
            res.redirect(returnTo);
        } catch (err) {
            console.error('Error en login:', err);
            res.render('kiosco/login', { error: 'Error del servidor' });
        }
    },

    async logout(req, res) {
        if (req.session.usuario) {
            await Auditoria.registrar(req.session.usuario.id, 'logout', 'Cierre de sesión', req.ip);
        }
        req.session.destroy(() => {
            res.redirect('/kiosco/login');
        });
    }
};

module.exports = authController;
