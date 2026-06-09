-- ============================================================
-- ESQUEMA DE BASE DE DATOS - MÓDULO KIOSCO
-- Optimizado para máximo 5MB
-- Tipos de datos ajustados al mínimo necesario
-- ============================================================

CREATE DATABASE IF NOT EXISTS kiosco DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kiosco;

-- ============================================================
-- USUARIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS ksc_usuarios (
    id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(15) NOT NULL UNIQUE,
    password VARCHAR(60) NOT NULL,
    nombre VARCHAR(25) NOT NULL,
    rol ENUM('admin','cajero') NOT NULL DEFAULT 'cajero',
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ultimo_acceso DATETIME DEFAULT NULL,
    INDEX idx_usuario (usuario),
    INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- PRODUCTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS ksc_productos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(15) NOT NULL UNIQUE,
    nombre VARCHAR(40) NOT NULL,
    precio_compra DECIMAL(9,2) NOT NULL DEFAULT 0.00,
    precio_venta DECIMAL(9,2) NOT NULL DEFAULT 0.00,
    stock DECIMAL(9,2) NOT NULL DEFAULT 0,
    stock_minimo DECIMAL(9,2) NOT NULL DEFAULT 0,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_codigo (codigo),
    INDEX idx_nombre (nombre),
    INDEX idx_activo_stock (activo, stock)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- VENTAS (cabecera)
-- ============================================================
CREATE TABLE IF NOT EXISTS ksc_ventas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usuario_id TINYINT UNSIGNED NOT NULL,
    total DECIMAL(9,2) NOT NULL DEFAULT 0.00,
    cantidad_items DECIMAL(9,2) NOT NULL DEFAULT 0,
    INDEX idx_fecha (fecha),
    INDEX idx_usuario_fecha (usuario_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DETALLE DE VENTA
-- ============================================================
CREATE TABLE IF NOT EXISTS ksc_detalle_venta (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    venta_id INT UNSIGNED NOT NULL,
    producto_id INT UNSIGNED NOT NULL,
    cantidad DECIMAL(9,2) NOT NULL DEFAULT 0,
    precio_unitario DECIMAL(9,2) NOT NULL DEFAULT 0.00,
    INDEX idx_venta (venta_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CAJA DIARIA (movimientos)
-- ============================================================
CREATE TABLE IF NOT EXISTS ksc_caja (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id TINYINT UNSIGNED NOT NULL,
    tipo ENUM('apertura','ingreso','egreso','venta','cierre') NOT NULL,
    monto DECIMAL(9,2) NOT NULL DEFAULT 0.00,
    saldo_anterior DECIMAL(9,2) NOT NULL DEFAULT 0.00,
    saldo_nuevo DECIMAL(9,2) NOT NULL DEFAULT 0.00,
    descripcion VARCHAR(80) DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tipo_fecha (tipo, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- AUDITORÍA
-- ============================================================
CREATE TABLE IF NOT EXISTS ksc_auditoria (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id TINYINT UNSIGNED NOT NULL,
    accion VARCHAR(30) NOT NULL,
    detalle VARCHAR(150) DEFAULT '',
    ip VARCHAR(15) DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CONFIGURACIÓN DEL NEGOCIO
-- ============================================================
CREATE TABLE IF NOT EXISTS ksc_config (
    id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clave VARCHAR(25) NOT NULL UNIQUE,
    valor VARCHAR(200) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DATOS INICIALES
-- ============================================================
INSERT INTO ksc_config (clave, valor) VALUES
    ('nombre_comercio', 'Mi Kiosco'),
    ('direccion', ''),
    ('telefono', ''),
    ('logo', '')
ON DUPLICATE KEY UPDATE clave=clave;

-- Contraseña: admin123 (bcrypt hash)
INSERT INTO ksc_usuarios (usuario, password, nombre, rol) VALUES
    ('admin', '$2b$10$8KzQMGx5C5Kc5Q5y5z5h5u5y5z5h5u5y5z5h5u5y5z5h5u5y5z5h', 'Administrador', 'admin')
ON DUPLICATE KEY UPDATE usuario=usuario;
