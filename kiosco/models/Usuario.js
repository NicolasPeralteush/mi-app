const db = require('../config/db');

const Usuario = {
    async getAll(activo = null) {
        let sql = 'SELECT id, usuario, nombre, rol, activo, created_at, ultimo_acceso FROM ksc_usuarios';
        const params = [];
        if (activo !== null) {
            sql += ' WHERE activo = ?';
            params.push(activo);
        }
        sql += ' ORDER BY id ASC';
        return await db.query(sql, params);
    },

    async getById(id) {
        const rows = await db.query(
            'SELECT id, usuario, nombre, rol, activo, created_at, ultimo_acceso FROM ksc_usuarios WHERE id = ?',
            [id]
        );
        return rows[0] || null;
    },

    async getByUsuario(usuario) {
        const rows = await db.query(
            'SELECT id, usuario, password, nombre, rol, activo, ultimo_acceso FROM ksc_usuarios WHERE usuario = ?',
            [usuario]
        );
        return rows[0] || null;
    },

    async create(data) {
        const result = await db.query(
            'INSERT INTO ksc_usuarios (usuario, password, nombre, rol, activo) VALUES (?, ?, ?, ?, ?)',
            [data.usuario, data.password, data.nombre, data.rol || 'cajero', data.activo !== undefined ? data.activo : 1]
        );
        return result.insertId;
    },

    async update(id, data) {
        const fields = [];
        const params = [];
        if (data.nombre) { fields.push('nombre = ?'); params.push(data.nombre); }
        if (data.rol) { fields.push('rol = ?'); params.push(data.rol); }
        if (data.activo !== undefined) { fields.push('activo = ?'); params.push(data.activo); }
        if (data.password) { fields.push('password = ?'); params.push(data.password); }
        if (fields.length === 0) return false;
        params.push(id);
        await db.query(`UPDATE ksc_usuarios SET ${fields.join(', ')} WHERE id = ?`, params);
        return true;
    },

    async delete(id) {
        await db.query('UPDATE ksc_usuarios SET activo = 0 WHERE id = ?', [id]);
    },

    async updateLastAccess(id) {
        await db.query('UPDATE ksc_usuarios SET ultimo_acceso = NOW() WHERE id = ?', [id]);
    }
};

module.exports = Usuario;
