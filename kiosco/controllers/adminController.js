const bcrypt = require('bcrypt');
const Usuario = require('../models/Usuario');
const Auditoria = require('../models/Auditoria');
const Configuracion = require('../models/Configuracion');

const adminController = {
    async usuarios(req, res) {
        try {
            const usuarios = await Usuario.getAll();
            res.render('kiosco/admin/usuarios', {
                usuarios,
                usuario: req.session.usuario,
                error: null,
                success: null
            });
        } catch (err) {
            console.error('Error al listar usuarios:', err);
            res.status(500).render('kiosco/error', { mensaje: 'Error al cargar usuarios' });
        }
    },

    async crearUsuario(req, res) {
        try {
            const { usuario, password, nombre, rol } = req.body;
            if (!usuario || !password || !nombre) {
                const usuarios = await Usuario.getAll();
                return res.render('kiosco/admin/usuarios', {
                    usuarios,
                    usuario: req.session.usuario,
                    error: 'Todos los campos son obligatorios',
                    success: null
                });
            }
            const existente = await Usuario.getByUsuario(usuario);
            if (existente) {
                const usuarios = await Usuario.getAll();
                return res.render('kiosco/admin/usuarios', {
                    usuarios,
                    usuario: req.session.usuario,
                    error: 'El nombre de usuario ya existe',
                    success: null
                });
            }
            const hash = await bcrypt.hash(password, 10);
            await Usuario.create({
                usuario,
                password: hash,
                nombre,
                rol: rol || 'cajero'
            });
            await Auditoria.registrar(req.session.usuario.id, 'usuario_create',
                `Creó usuario: ${usuario}`, req.ip);
            res.redirect('/kiosco/admin/usuarios');
        } catch (err) {
            console.error('Error al crear usuario:', err);
            res.status(500).render('kiosco/error', { mensaje: 'Error al crear usuario' });
        }
    },

    async cambiarPassword(req, res) {
        try {
            const id = req.params.id;
            const { password } = req.body;
            if (!password || password.length < 4) {
                const usuarios = await Usuario.getAll();
                return res.render('kiosco/admin/usuarios', {
                    usuarios,
                    usuario: req.session.usuario,
                    error: 'La contraseña debe tener al menos 4 caracteres',
                    success: null
                });
            }
            const hash = await bcrypt.hash(password, 10);
            await Usuario.update(id, { password: hash });
            await Auditoria.registrar(req.session.usuario.id, 'usuario_password',
                `Cambió contraseña del usuario #${id}`, req.ip);
            res.redirect('/kiosco/admin/usuarios');
        } catch (err) {
            console.error('Error al cambiar password:', err);
            res.status(500).render('kiosco/error', { mensaje: 'Error al cambiar contraseña' });
        }
    },

    async toggleUsuario(req, res) {
        try {
            const id = req.params.id;
            const user = await Usuario.getById(id);
            if (!user) {
                return res.status(404).render('kiosco/error', { mensaje: 'Usuario no encontrado' });
            }
            await Usuario.update(id, { activo: user.activo ? 0 : 1 });
            await Auditoria.registrar(req.session.usuario.id, 'usuario_toggle',
                `${user.activo ? 'Desactivó' : 'Activó'} usuario: ${user.usuario}`, req.ip);
            res.redirect('/kiosco/admin/usuarios');
        } catch (err) {
            console.error('Error al toggle usuario:', err);
            res.status(500).render('kiosco/error', { mensaje: 'Error al modificar usuario' });
        }
    },

    async config(req, res) {
        try {
            const config = await Configuracion.getAll();
            res.render('kiosco/admin/config', {
                config,
                usuario: req.session.usuario,
                error: null,
                success: null
            });
        } catch (err) {
            console.error('Error al cargar config:', err);
            res.status(500).render('kiosco/error', { mensaje: 'Error al cargar configuración' });
        }
    },

    async guardarConfig(req, res) {
        try {
            const data = {};
            for (const [key, value] of Object.entries(req.body)) {
                if (key.startsWith('cfg_')) {
                    data[key.replace('cfg_', '')] = value;
                }
            }
            if (req.file) {
                data.logo = req.file.path.replace(/\\/g, '/');
            }
            await Configuracion.updateMultiple(data);
            await Auditoria.registrar(req.session.usuario.id, 'config_update',
                'Actualizó configuración del negocio', req.ip);
            res.redirect('/kiosco/admin/config');
        } catch (err) {
            console.error('Error al guardar config:', err);
            res.status(500).render('kiosco/error', { mensaje: 'Error al guardar configuración' });
        }
    },

    async auditoria(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const result = await Auditoria.getAll(page);
            res.render('kiosco/admin/auditoria', {
                registros: result.rows,
                total: result.total,
                pages: result.pages,
                page,
                usuario: req.session.usuario
            });
        } catch (err) {
            console.error('Error al cargar auditoría:', err);
            res.status(500).render('kiosco/error', { mensaje: 'Error al cargar auditoría' });
        }
    }
};

module.exports = adminController;
