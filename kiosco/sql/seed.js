// Script para inicializar la base de datos del módulo Kiosco
// Uso: node kiosco/sql/seed.js
// Requiere: base de datos MySQL creada y configurada en .env
require('dotenv').config();
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('=== Inicializando base de datos del Kiosco ===\n');

    const config = {
        host: process.env.K_DB_HOST || process.env.DB_HOST || 'localhost',
        user: process.env.K_DB_USER || process.env.DB_USER || 'root',
        password: process.env.K_DB_PASS || process.env.DB_PASS || '',
        database: process.env.K_DB_NAME || process.env.DB_NAME || 'kiosco',
        port: parseInt(process.env.K_DB_PORT || process.env.DB_PORT || 3306),
        multipleStatements: true
    };

    let conn;
    try {
        conn = await mysql.createConnection(config);

        // Ejecutar schema
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await conn.query(schema);
        console.log('✓ Tablas creadas correctamente');

        // Generar hash para admin
        const hash = await bcrypt.hash('admin123', 10);
        await conn.execute(
            `UPDATE ksc_usuarios SET password = ? WHERE usuario = 'admin'`,
            [hash]
        );
        console.log('✓ Usuario admin creado (contraseña: admin123)');

        // Insertar producto de ejemplo
        await conn.execute(
            `INSERT INTO ksc_productos (codigo, nombre, precio_compra, precio_venta, stock, stock_minimo)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE nombre=nombre`,
            ['PROD-001', 'Producto de ejemplo', 50.00, 100.00, 10, 2]
        );
        console.log('✓ Producto de ejemplo creado');

        console.log('\n=== Inicialización completada ===');
        console.log('Usuario: admin');
        console.log('Contraseña: admin123');
    } catch (err) {
        console.error('Error:', err.message);
        console.log('\nVerifique que:');
        console.log('1. MySQL esté corriendo');
        console.log('2. Las variables de entorno estén configuradas en .env');
        console.log('3. La base de datos exista (mysql> CREATE DATABASE kiosco)');
    } finally {
        if (conn) await conn.end();
    }
}

main();
