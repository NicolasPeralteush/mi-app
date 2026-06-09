const Venta = require('../models/Venta');
const Caja = require('../models/Caja');
const Producto = require('../models/Producto');

const dashboardController = {
    async index(req, res) {
        try {
            const ventasDia = await Venta.getVentasDelDia();
            const caja = await Caja.getEstadoActual();
            const bajoStock = await Producto.getLowStock(5);
            const ultimasVentas = await Venta.getAll(1, 5);

            res.render('kiosco/dashboard', {
                ventasDia,
                caja,
                bajoStock,
                ultimasVentas: ultimasVentas.rows,
                usuario: req.session.usuario
            });
        } catch (err) {
            console.error('Error en dashboard:', err);
            res.status(500).render('kiosco/error', { mensaje: 'Error al cargar el dashboard' });
        }
    }
};

module.exports = dashboardController;
