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
                console.log('[LOGIN] Usuario no encontrado:', usuario);
                return res.render('kiosco/login', { error: 'Credenciales inválidas' });
            }
            const user = users[0];
            if (!user.activo) {
                console.log('[LOGIN] Usuario desactivado:', usuario);
                return res.render('kiosco/login', { error: 'Usuario desactivado' });
            }
            console.log('[LOGIN] Hash almacenado:', user.password ? user.password.substring(0, 15) + '...' : 'VACÍO');
            const match = await bcrypt.compare(password, user.password);
            console.log('[LOGIN] Resultado bcrypt.compare:', match);
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
            console.error('[LOGIN] Error:', err);
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
    },

    async debug(req, res) {
        try {
            const users = await db.query(
                'SELECT id, usuario, nombre, rol, activo, password FROM ksc_usuarios WHERE usuario = ?',
                ['admin']
            );
            if (users.length === 0) {
                return res.json({ error: 'Usuario admin no encontrado' });
            }
            const user = users[0];
            const testPass = 'admin123';
            const match = await bcrypt.compare(testPass, user.password);
            res.json({
                existe: true,
                usuario: user.usuario,
                nombre: user.nombre,
                rol: user.rol,
                activo: !!user.activo,
                hash_preview: user.password ? user.password.substring(0, 20) + '...' : 'VACÍO',
                hash_length: user.password ? user.password.length : 0,
                bcrypt_compare: match,
                mensaje: match ? 'OK - contraseña válida' : 'ERROR - contraseña NO coincide'
            });
        } catch (err) {
            res.json({ error: err.message });
        }
    }
};

module.exports = authController;
