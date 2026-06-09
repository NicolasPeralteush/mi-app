const db = require('../config/db');

const Configuracion = {
    async getAll() {
        const rows = await db.query('SELECT clave, valor FROM ksc_config');
        const config = {};
        for (const r of rows) {
            config[r.clave] = r.valor;
        }
        return config;
    },

    async get(clave) {
        const rows = await db.query('SELECT valor FROM ksc_config WHERE clave = ?', [clave]);
        return rows.length > 0 ? rows[0].valor : null;
    },

    async set(clave, valor) {
        await db.query(
            'INSERT INTO ksc_config (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = ?',
            [clave, valor, valor]
        );
    },

    async updateMultiple(data) {
        for (const [clave, valor] of Object.entries(data)) {
            await this.set(clave, valor);
        }
    }
};

module.exports = Configuracion;
