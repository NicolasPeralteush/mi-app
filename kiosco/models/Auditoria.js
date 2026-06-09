const db = require('../config/db');

const Auditoria = {
    async registrar(usuarioId, accion, detalle = '', ip = '') {
        await db.query(
            'INSERT INTO ksc_auditoria (usuario_id, accion, detalle, ip) VALUES (?, ?, ?, ?)',
            [usuarioId, accion, detalle, ip]
        );
    },

    async getAll(page = 1, limit = 50) {
        const offset = (page - 1) * limit;
        const rows = await db.query(
            `SELECT a.*, u.nombre AS usuario_nombre, u.usuario
             FROM ksc_auditoria a
             LEFT JOIN ksc_usuarios u ON u.id = a.usuario_id
             ORDER BY a.id DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        const count = await db.query('SELECT COUNT(*) AS total FROM ksc_auditoria');
        return { rows, total: count[0].total, pages: Math.ceil(count[0].total / limit) };
    },

    async limpiarViejos(dias = 30) {
        await db.query(
            'DELETE FROM ksc_auditoria WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
            [dias]
        );
    }
};

module.exports = Auditoria;
