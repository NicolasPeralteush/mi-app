const db = require('../config/db');

const Producto = {
    async getAll(page = 1, limit = 20, soloActivos = false) {
        const offset = (page - 1) * limit;
        let where = '';
        const params = [];
        if (soloActivos) {
            where = 'WHERE activo = 1';
        }
        const rows = await db.query(
            `SELECT id, codigo, nombre, precio_compra, precio_venta, stock, stock_minimo, activo
             FROM ksc_productos ${where} ORDER BY nombre ASC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );
        const count = await db.query(
            `SELECT COUNT(*) AS total FROM ksc_productos ${where}`,
            params
        );
        return { rows, total: count[0].total, pages: Math.ceil(count[0].total / limit) };
    },

    async search(term, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const like = `%${term}%`;
        const rows = await db.query(
            `SELECT id, codigo, nombre, precio_compra, precio_venta, stock, stock_minimo, activo
             FROM ksc_productos
             WHERE (codigo LIKE ? OR nombre LIKE ?) AND activo = 1
             ORDER BY nombre ASC LIMIT ? OFFSET ?`,
            [like, like, limit, offset]
        );
        const count = await db.query(
            `SELECT COUNT(*) AS total FROM ksc_productos WHERE (codigo LIKE ? OR nombre LIKE ?) AND activo = 1`,
            [like, like]
        );
        return { rows, total: count[0].total, pages: Math.ceil(count[0].total / limit) };
    },

    async getById(id) {
        const rows = await db.query(
            'SELECT id, codigo, nombre, precio_compra, precio_venta, stock, stock_minimo, activo FROM ksc_productos WHERE id = ?',
            [id]
        );
        return rows[0] || null;
    },

    async getByCodigo(codigo) {
        const rows = await db.query(
            'SELECT id, codigo, nombre, precio_compra, precio_venta, stock, stock_minimo, activo FROM ksc_productos WHERE codigo = ?',
            [codigo]
        );
        return rows[0] || null;
    },

    async create(data) {
        const result = await db.query(
            `INSERT INTO ksc_productos (codigo, nombre, precio_compra, precio_venta, stock, stock_minimo, activo)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [data.codigo, data.nombre, data.precio_compra || 0, data.precio_venta || 0,
             data.stock || 0, data.stock_minimo || 0, data.activo !== undefined ? data.activo : 1]
        );
        return result.insertId;
    },

    async update(id, data) {
        await db.query(
            `UPDATE ksc_productos SET codigo = ?, nombre = ?, precio_compra = ?, precio_venta = ?,
             stock = ?, stock_minimo = ?, activo = ?, updated_at = NOW() WHERE id = ?`,
            [data.codigo, data.nombre, data.precio_compra, data.precio_venta,
             data.stock, data.stock_minimo, data.activo, id]
        );
    },

    async delete(id) {
        await db.query('UPDATE ksc_productos SET activo = 0 WHERE id = ?', [id]);
    },

    async getLowStock(limit = 10) {
        return await db.query(
            `SELECT id, codigo, nombre, stock, stock_minimo
             FROM ksc_productos
             WHERE activo = 1 AND stock <= stock_minimo
             ORDER BY stock ASC LIMIT ?`,
            [limit]
        );
    },

    async getByCodigoSearch(term) {
        const like = `%${term}%`;
        return await db.query(
            `SELECT id, codigo, nombre, precio_venta, stock
             FROM ksc_productos WHERE activo = 1 AND (codigo LIKE ? OR nombre LIKE ?)
             ORDER BY nombre ASC LIMIT 20`,
            [like, like]
        );
    }
};

module.exports = Producto;
