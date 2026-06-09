const Producto = require('../models/Producto');
const Auditoria = require('../models/Auditoria');

const productoController = {
    async index(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const q = (req.query.q || '').trim();
            let result;
            if (q) {
                result = await Producto.search(q, page);
            } else {
                result = await Producto.getAll(page);
            }
            res.render('kiosco/productos/index', {
                productos: result.rows,
                total: result.total,
                pages: result.pages,
                page,
                q,
                usuario: req.session.usuario
            });
        } catch (err) {
            console.error('Error en productos:', err);
            res.status(500).render('kiosco/error', { mensaje: 'Error al cargar productos' });
        }
    },

    async form(req, res) {
        const id = req.params.id;
        let producto = null;
        if (id) {
            producto = await Producto.getById(id);
            if (!producto) {
                return res.status(404).render('kiosco/error', { mensaje: 'Producto no encontrado' });
            }
        }
        res.render('kiosco/productos/form', {
            producto,
            usuario: req.session.usuario,
            error: null
        });
    },

    async save(req, res) {
        try {
            const id = req.params.id;
            const data = {
                codigo: (req.body.codigo || '').trim().toUpperCase(),
                nombre: (req.body.nombre || '').trim(),
                precio_compra: parseFloat(req.body.precio_compra) || 0,
                precio_venta: parseFloat(req.body.precio_venta) || 0,
                stock: parseFloat(req.body.stock) || 0,
                stock_minimo: parseFloat(req.body.stock_minimo) || 0,
                activo: req.body.activo !== undefined ? parseInt(req.body.activo) : 1
            };

            if (!data.codigo || !data.nombre) {
                const producto = id ? await Producto.getById(id) : null;
                return res.render('kiosco/productos/form', {
                    producto,
                    usuario: req.session.usuario,
                    error: 'Código y nombre son obligatorios'
                });
            }

            if (id) {
                const existente = await Producto.getByCodigo(data.codigo);
                if (existente && parseInt(existente.id) !== parseInt(id)) {
                    const producto = await Producto.getById(id);
                    return res.render('kiosco/productos/form', {
                        producto,
                        usuario: req.session.usuario,
                        error: 'El código ya está en uso'
                    });
                }
                await Producto.update(id, data);
                await Auditoria.registrar(req.session.usuario.id, 'producto_update',
                    `Actualizó producto #${id}: ${data.nombre}`, req.ip);
            } else {
                const existente = await Producto.getByCodigo(data.codigo);
                if (existente) {
                    return res.render('kiosco/productos/form', {
                        producto: null,
                        usuario: req.session.usuario,
                        error: 'El código ya está en uso'
                    });
                }
                const newId = await Producto.create(data);
                await Auditoria.registrar(req.session.usuario.id, 'producto_create',
                    `Creó producto #${newId}: ${data.nombre}`, req.ip);
            }
            res.redirect('/kiosco/productos');
        } catch (err) {
            console.error('Error al guardar producto:', err);
            res.status(500).render('kiosco/error', { mensaje: 'Error al guardar producto' });
        }
    },

    async delete(req, res) {
        try {
            const id = req.params.id;
            const producto = await Producto.getById(id);
            if (!producto) {
                return res.status(404).render('kiosco/error', { mensaje: 'Producto no encontrado' });
            }
            await Producto.delete(id);
            await Auditoria.registrar(req.session.usuario.id, 'producto_delete',
                `Desactivó producto #${id}: ${producto.nombre}`, req.ip);
            res.redirect('/kiosco/productos');
        } catch (err) {
            console.error('Error al eliminar producto:', err);
            res.status(500).render('kiosco/error', { mensaje: 'Error al eliminar producto' });
        }
    }
};

module.exports = productoController;
