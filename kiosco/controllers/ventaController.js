const Venta = require('../models/Venta');
const Producto = require('../models/Producto');
const Auditoria = require('../models/Auditoria');

const ventaController = {
    async pos(req, res) {
        res.render('kiosco/ventas/pos', {
            usuario: req.session.usuario,
            error: null,
            success: null
        });
    },

    async buscarProducto(req, res) {
        try {
            const term = (req.query.q || '').trim();
            if (!term) return res.json([]);
            const productos = await Producto.getByCodigoSearch(term);
            res.json(productos);
        } catch (err) {
            console.error('Error al buscar productos:', err);
            res.status(500).json([]);
        }
    },

    async registrar(req, res) {
        try {
            const { items } = req.body;
            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.render('kiosco/ventas/pos', {
                    usuario: req.session.usuario,
                    error: 'Debe agregar al menos un producto',
                    success: null
                });
            }

            for (const item of items) {
                if (!item.id || !item.cantidad || item.cantidad <= 0) {
                    return res.render('kiosco/ventas/pos', {
                        usuario: req.session.usuario,
                        error: 'Datos de producto inválidos',
                        success: null
                    });
                }
                const producto = await Producto.getById(item.id);
                if (!producto || !producto.activo) {
                    return res.render('kiosco/ventas/pos', {
                        usuario: req.session.usuario,
                        error: `Producto ID ${item.id} no encontrado`,
                        success: null
                    });
                }
                if (producto.stock < item.cantidad) {
                    return res.render('kiosco/ventas/pos', {
                        usuario: req.session.usuario,
                        error: `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}`,
                        success: null
                    });
                }
            }

            let total = 0;
            let cantidadItems = 0;
            const detalle = items.map(item => {
                const subtotal = parseFloat(item.precio) * parseFloat(item.cantidad);
                total += subtotal;
                cantidadItems += parseFloat(item.cantidad);
                return {
                    producto_id: item.id,
                    cantidad: parseFloat(item.cantidad),
                    precio_unitario: parseFloat(item.precio)
                };
            });

            const ventaId = await Venta.create(
                { usuario_id: req.session.usuario.id, total, cantidad_items: cantidadItems },
                detalle
            );

            await Auditoria.registrar(req.session.usuario.id, 'venta_create',
                `Registró venta #${ventaId} por $${total.toFixed(2)}`, req.ip);

            res.render('kiosco/ventas/pos', {
                usuario: req.session.usuario,
                error: null,
                success: { id: ventaId, total: total.toFixed(2) }
            });
        } catch (err) {
            console.error('Error al registrar venta:', err);
            res.render('kiosco/ventas/pos', {
                usuario: req.session.usuario,
                error: 'Error al registrar la venta',
                success: null
            });
        }
    },

    async historial(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const hoy = new Date();
            const fechaDesde = req.query.desde || new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
            const fechaHasta = req.query.hasta || hoy.toISOString().split('T')[0];
            const result = await Venta.getAll(page, 20, fechaDesde + ' 00:00:00', fechaHasta + ' 23:59:59');
            res.render('kiosco/ventas/historial', {
                ventas: result.rows,
                total: result.total,
                pages: result.pages,
                page,
                fechaDesde,
                fechaHasta,
                usuario: req.session.usuario
            });
        } catch (err) {
            console.error('Error en historial:', err);
            res.status(500).render('kiosco/error', { mensaje: 'Error al cargar historial' });
        }
    },

    async detalle(req, res) {
        try {
            const data = await Venta.getById(req.params.id);
            if (!data) {
                return res.status(404).render('kiosco/error', { mensaje: 'Venta no encontrada' });
            }
            res.json(data);
        } catch (err) {
            console.error('Error al obtener detalle:', err);
            res.status(500).json({ error: 'Error al obtener detalle' });
        }
    }
};

module.exports = ventaController;
