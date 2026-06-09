const Caja = require('../models/Caja');
const Auditoria = require('../models/Auditoria');

const cajaController = {
    async index(req, res) {
        try {
            const estado = await Caja.getEstadoActual();
            const resumen = await Caja.getResumenDelDia();
            res.render('kiosco/caja/index', {
                estado,
                resumen,
                usuario: req.session.usuario,
                error: null,
                success: null
            });
        } catch (err) {
            console.error('Error en caja:', err);
            res.status(500).render('kiosco/error', { mensaje: 'Error al cargar caja' });
        }
    },

    async apertura(req, res) {
        try {
            const monto = parseFloat(req.body.monto) || 0;
            await Caja.apertura(req.session.usuario.id, monto);
            await Auditoria.registrar(req.session.usuario.id, 'caja_apertura',
                `Apertura de caja con $${monto.toFixed(2)}`, req.ip);
            res.redirect('/kiosco/caja');
        } catch (err) {
            console.error('Error en apertura:', err);
            const estado = await Caja.getEstadoActual();
            const resumen = await Caja.getResumenDelDia();
            res.render('kiosco/caja/index', {
                estado, resumen,
                usuario: req.session.usuario,
                error: err.message,
                success: null
            });
        }
    },

    async ingreso(req, res) {
        try {
            const monto = parseFloat(req.body.monto) || 0;
            const descripcion = (req.body.descripcion || '').trim();
            if (monto <= 0) throw new Error('El monto debe ser mayor a 0');
            if (!descripcion) throw new Error('La descripción es obligatoria');
            await Caja.ingreso(req.session.usuario.id, monto, descripcion);
            await Auditoria.registrar(req.session.usuario.id, 'caja_ingreso',
                `Ingreso de $${monto.toFixed(2)}: ${descripcion}`, req.ip);
            res.redirect('/kiosco/caja');
        } catch (err) {
            const estado = await Caja.getEstadoActual();
            const resumen = await Caja.getResumenDelDia();
            res.render('kiosco/caja/index', {
                estado, resumen,
                usuario: req.session.usuario,
                error: err.message,
                success: null
            });
        }
    },

    async egreso(req, res) {
        try {
            const monto = parseFloat(req.body.monto) || 0;
            const descripcion = (req.body.descripcion || '').trim();
            if (monto <= 0) throw new Error('El monto debe ser mayor a 0');
            if (!descripcion) throw new Error('La descripción es obligatoria');
            await Caja.egreso(req.session.usuario.id, monto, descripcion);
            await Auditoria.registrar(req.session.usuario.id, 'caja_egreso',
                `Egreso de $${monto.toFixed(2)}: ${descripcion}`, req.ip);
            res.redirect('/kiosco/caja');
        } catch (err) {
            const estado = await Caja.getEstadoActual();
            const resumen = await Caja.getResumenDelDia();
            res.render('kiosco/caja/index', {
                estado, resumen,
                usuario: req.session.usuario,
                error: err.message,
                success: null
            });
        }
    },

    async cierre(req, res) {
        try {
            const estado = await Caja.getEstadoActual();
            if (!estado.abierta) throw new Error('La caja ya está cerrada');
            await Caja.cierre(req.session.usuario.id);
            await Auditoria.registrar(req.session.usuario.id, 'caja_cierre',
                `Cierre de caja. Saldo final: $${estado.saldo.toFixed(2)}`, req.ip);
            res.redirect('/kiosco/caja');
        } catch (err) {
            const estadoActual = await Caja.getEstadoActual();
            const resumen = await Caja.getResumenDelDia();
            res.render('kiosco/caja/index', {
                estado: estadoActual, resumen,
                usuario: req.session.usuario,
                error: err.message,
                success: null
            });
        }
    },

    async historial(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const result = await Caja.getHistorial(page);
            res.render('kiosco/caja/historial', {
                movimientos: result.rows,
                total: result.total,
                pages: result.pages,
                page,
                usuario: req.session.usuario
            });
        } catch (err) {
            console.error('Error en historial caja:', err);
            res.status(500).render('kiosco/error', { mensaje: 'Error al cargar historial' });
        }
    }
};

module.exports = cajaController;
