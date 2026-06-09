const mysql = require('mysql2/promise');

let pool;

function getPool() {
    if (!pool) {
        pool = mysql.createPool({
            host: process.env.K_DB_HOST || process.env.DB_HOST || 'localhost',
            user: process.env.K_DB_USER || process.env.DB_USER || 'root',
            password: process.env.K_DB_PASS || process.env.DB_PASS || '',
            database: process.env.K_DB_NAME || process.env.DB_NAME || 'kiosco',
            port: parseInt(process.env.K_DB_PORT || process.env.DB_PORT || 3306),
            waitForConnections: true,
            connectionLimit: 3,
            queueLimit: 0,
            charset: 'utf8mb4'
        });
    }
    return pool;
}

async function query(sql, params) {
    const c = await getPool().getConnection();
    try {
        const [rows] = await c.execute(sql, params);
        return rows;
    } finally {
        c.release();
    }
}

async function getConnection() {
    return await getPool().getConnection();
}

module.exports = { query, getConnection, getPool };
