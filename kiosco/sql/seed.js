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
        database: process.env.K_DB_NAME || process.env.DB_NAME || 'sql10829811',
        port: parseInt(process.env.K_DB_PORT || process.env.DB_PORT || 3306),
        multipleStatements: true
    };

    let conn;
    try {
        conn = await mysql.createConnection(config);

        // Limpiar tablas existentes
        const dropTables = `
            DROP TABLE IF EXISTS ksc_detalle_venta;
            DROP TABLE IF EXISTS ksc_caja;
            DROP TABLE IF EXISTS ksc_auditoria;
            DROP TABLE IF EXISTS ksc_ventas;
            DROP TABLE IF EXISTS ksc_productos;
            DROP TABLE IF EXISTS ksc_usuarios;
            DROP TABLE IF EXISTS ksc_config;
        `;
        await conn.query(dropTables);
        console.log('✓ Tablas anteriores eliminadas');

        // Ejecutar schema
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await conn.query(schema);
        console.log('✓ Tablas creadas correctamente');

        // Crear usuario admin con hash correcto
        const hash = await bcrypt.hash('admin123', 10);
        console.log('[DEBUG] Hash generado:', hash, '| longitud:', hash.length);
        await conn.query(
            `INSERT INTO ksc_usuarios (usuario, password, nombre, rol) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE password = ?`,
            ['admin', hash, 'Administrador', 'admin', hash]
        );
        // Verificar que el hash funciona
        const [rows] = await conn.query(
            'SELECT password FROM ksc_usuarios WHERE usuario = ?', ['admin']
        );
        const storedHash = rows[0].password;
        console.log('[DEBUG] Hash almacenado:', storedHash, '| longitud:', storedHash.length);
        const verify = await bcrypt.compare('admin123', storedHash);
        console.log('[DEBUG] bcrypt.compare("admin123", hash):', verify);
        if (!verify) throw new Error('La verificación de contraseña falló (hash: ' + storedHash + ')');
        console.log('✓ Usuario admin creado (contraseña: admin123)');

        // Insertar producto de ejemplo
        await conn.query(
            `INSERT INTO ksc_productos (codigo, nombre, precio_compra, precio_venta, stock, stock_minimo)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE codigo=codigo`,
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
        console.log('3. La base de datos exista (mysql> CREATE DATABASE sql10829811)');
    } finally {
        if (conn) await conn.end();
    }
}

main();
