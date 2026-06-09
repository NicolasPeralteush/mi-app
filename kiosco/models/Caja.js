const db = require('../config/db');

const Caja = {
    async getUltimoMovimiento() {
        const rows = await db.query(
            'SELECT * FROM ksc_caja ORDER BY id DESC LIMIT 1'
        );
        return rows[0] || null;
    },

    async getEstadoActual() {
        const ultimo = await this.getUltimoMovimiento();
        if (!ultimo) return { abierta: false, saldo: 0, ultimoMovimiento: null };

        if (ultimo.tipo === 'cierre') {
            const aperturaPosterior = await db.query(
                "SELECT * FROM ksc_caja WHERE tipo = 'apertura' AND id > ? ORDER BY id ASC LIMIT 1",
                [ultimo.id]
            );
            if (aperturaPosterior.length === 0) {
                return { abierta: false, saldo: 0, ultimoMovimiento: ultimo };
            }
            const movs = await db.query(
                `SELECT * FROM ksc_caja WHERE id >= ? ORDER BY id DESC LIMIT 1`,
                [aperturaPosterior[0].id]
            );
            return { abierta: true, saldo: movs[0].saldo_nuevo, ultimoMovimiento: movs[0] };
        }

        return { abierta: true, saldo: ultimo.saldo_nuevo, ultimoMovimiento: ultimo };
    },

    async apertura(usuarioId, montoInicial) {
        const ultimo = await this.getUltimoMovimiento();
        const saldoAnt = ultimo ? ultimo.saldo_nuevo : 0;
        const result = await db.query(
            `INSERT INTO ksc_caja (usuario_id, tipo, monto, saldo_anterior, saldo_nuevo, descripcion)
             VALUES (?, 'apertura', ?, ?, ?, 'Apertura de caja')`,
            [usuarioId, montoInicial, saldoAnt, parseFloat(montoInicial)]
        );
        return result.insertId;
    },

    async ingreso(usuarioId, monto, descripcion) {
        const ultimo = await this.getUltimoMovimiento();
        if (!ultimo) throw new Error('Debe aperturar la caja primero');
        const saldoAnt = ultimo.saldo_nuevo;
        const saldoNuevo = parseFloat(saldoAnt) + parseFloat(monto);
        const result = await db.query(
            `INSERT INTO ksc_caja (usuario_id, tipo, monto, saldo_anterior, saldo_nuevo, descripcion)
             VALUES (?, 'ingreso', ?, ?, ?, ?)`,
            [usuarioId, monto, saldoAnt, saldoNuevo, descripcion]
        );
        return result.insertId;
    },

    async egreso(usuarioId, monto, descripcion) {
        const ultimo = await this.getUltimoMovimiento();
        if (!ultimo) throw new Error('Debe aperturar la caja primero');
        const saldoAnt = ultimo.saldo_nuevo;
        const saldoNuevo = parseFloat(saldoAnt) - parseFloat(monto);
        if (saldoNuevo < 0) throw new Error('Saldo insuficiente');
        const result = await db.query(
            `INSERT INTO ksc_caja (usuario_id, tipo, monto, saldo_anterior, saldo_nuevo, descripcion)
             VALUES (?, 'egreso', ?, ?, ?, ?)`,
            [usuarioId, monto, saldoAnt, saldoNuevo, descripcion]
        );
        return result.insertId;
    },

    async cierre(usuarioId) {
        const ultimo = await this.getUltimoMovimiento();
        if (!ultimo) throw new Error('No hay caja abierta');
        const result = await db.query(
            `INSERT INTO ksc_caja (usuario_id, tipo, monto, saldo_anterior, saldo_nuevo, descripcion)
             VALUES (?, 'cierre', ?, ?, ?, 'Cierre de caja')`,
            [usuarioId, ultimo.saldo_nuevo, ultimo.saldo_nuevo, ultimo.saldo_nuevo]
        );
        return result.insertId;
    },

    async getHistorial(page = 1, limit = 30) {
        const offset = (page - 1) * limit;
        const rows = await db.query(
            `SELECT c.*, u.nombre AS usuario_nombre
             FROM ksc_caja c
             LEFT JOIN ksc_usuarios u ON u.id = c.usuario_id
             ORDER BY c.id DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        const count = await db.query('SELECT COUNT(*) AS total FROM ksc_caja');
        return { rows, total: count[0].total, pages: Math.ceil(count[0].total / limit) };
    },

    async getResumenDelDia() {
        const rows = await db.query(
            `SELECT tipo, SUM(monto) AS total FROM ksc_caja
             WHERE DATE(created_at) = CURDATE()
             GROUP BY tipo`
        );
        const resumen = { ventas: 0, ingresos: 0, egresos: 0, apertura: 0, cierre: 0 };
        for (const r of rows) {
            if (r.tipo === 'venta') resumen.ventas = parseFloat(r.total);
            else if (r.tipo === 'ingreso') resumen.ingresos = parseFloat(r.total);
            else if (r.tipo === 'egreso') resumen.egresos = parseFloat(r.total);
            else if (r.tipo === 'apertura') resumen.apertura = parseFloat(r.total);
            else if (r.tipo === 'cierre') resumen.cierre = parseFloat(r.total);
        }
        return resumen;
    }
};

module.exports = Caja;
