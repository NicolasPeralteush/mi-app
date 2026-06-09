const db = require('../config/db');

const Venta = {
    async create(data, detalle) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const [ventaResult] = await conn.execute(
                `INSERT INTO ksc_ventas (usuario_id, total, cantidad_items) VALUES (?, ?, ?)`,
                [data.usuario_id, data.total, data.cantidad_items]
            );
            const ventaId = ventaResult.insertId;

            for (const item of detalle) {
                await conn.execute(
                    `INSERT INTO ksc_detalle_venta (venta_id, producto_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)`,
                    [ventaId, item.producto_id, item.cantidad, item.precio_unitario]
                );
                await conn.execute(
                    `UPDATE ksc_productos SET stock = stock - ? WHERE id = ?`,
                    [item.cantidad, item.producto_id]
                );
            }

            await conn.execute(
                `INSERT INTO ksc_caja (usuario_id, tipo, monto, saldo_anterior, saldo_nuevo, descripcion)
                 VALUES (?, 'venta', ?, 0, 0, CONCAT('Venta #', ?))`,
                [data.usuario_id, data.total, ventaId]
            );

            await conn.commit();
            return ventaId;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    },

    async getAll(page = 1, limit = 20, fechaDesde = null, fechaHasta = null) {
        const offset = (page - 1) * limit;
        let where = '';
        const params = [];
        if (fechaDesde && fechaHasta) {
            where = 'WHERE v.fecha BETWEEN ? AND ?';
            params.push(fechaDesde, fechaHasta);
        }
        const rows = await db.query(
            `SELECT v.id, v.fecha, v.total, v.cantidad_items, u.nombre AS usuario_nombre
             FROM ksc_ventas v
             LEFT JOIN ksc_usuarios u ON u.id = v.usuario_id
             ${where}
             ORDER BY v.fecha DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );
        const count = await db.query(
            `SELECT COUNT(*) AS total FROM ksc_ventas v ${where}`,
            params
        );
        return { rows, total: count[0].total, pages: Math.ceil(count[0].total / limit) };
    },

    async getById(id) {
        const rows = await db.query(
            `SELECT v.*, u.nombre AS usuario_nombre
             FROM ksc_ventas v
             LEFT JOIN ksc_usuarios u ON u.id = v.usuario_id
             WHERE v.id = ?`,
            [id]
        );
        if (rows.length === 0) return null;
        const detalle = await db.query(
            `SELECT d.*, p.nombre, p.codigo
             FROM ksc_detalle_venta d
             LEFT JOIN ksc_productos p ON p.id = d.producto_id
             WHERE d.venta_id = ?`,
            [id]
        );
        return { venta: rows[0], detalle };
    },

    async getVentasDelDia() {
        const rows = await db.query(
            `SELECT COUNT(*) AS cantidad, COALESCE(SUM(total), 0) AS total,
                    COALESCE(SUM(cantidad_items), 0) AS items
             FROM ksc_ventas WHERE DATE(fecha) = CURDATE()`
        );
        return rows[0];
    },

    async getVentasPorDia(limit = 30) {
        return await db.query(
            `SELECT DATE(fecha) AS dia, COUNT(*) AS cantidad, SUM(total) AS total
             FROM ksc_ventas
             GROUP BY DATE(fecha)
             ORDER BY dia DESC LIMIT ?`,
            [limit]
        );
    },

    async getVentasPorMes(limit = 12) {
        return await db.query(
            `SELECT DATE_FORMAT(fecha, '%Y-%m') AS mes, COUNT(*) AS cantidad, SUM(total) AS total
             FROM ksc_ventas
             GROUP BY DATE_FORMAT(fecha, '%Y-%m')
             ORDER BY mes DESC LIMIT ?`,
            [limit]
        );
    },

    async getProductosMasVendidos(limit = 10) {
        return await db.query(
            `SELECT p.id, p.nombre, p.codigo, SUM(d.cantidad) AS total_vendido, SUM(d.cantidad * d.precio_unitario) AS total_ingresos
             FROM ksc_detalle_venta d
             JOIN ksc_productos p ON p.id = d.producto_id
             GROUP BY p.id, p.nombre, p.codigo
             ORDER BY total_vendido DESC LIMIT ?`,
            [limit]
        );
    },

    async getGananciaEstimada(desde, hasta) {
        const rows = await db.query(
            `SELECT SUM(d.cantidad * (d.precio_unitario - p.precio_compra)) AS ganancia
             FROM ksc_detalle_venta d
             JOIN ksc_productos p ON p.id = d.producto_id
             JOIN ksc_ventas v ON v.id = d.venta_id
             WHERE DATE(v.fecha) BETWEEN ? AND ?`,
            [desde, hasta]
        );
        return rows[0].ganancia || 0;
    }
};

module.exports = Venta;
