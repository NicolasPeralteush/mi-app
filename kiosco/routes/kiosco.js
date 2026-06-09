const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

const authController = require('../controllers/authController');
const dashboardController = require('../controllers/dashboardController');
const productoController = require('../controllers/productoController');
const ventaController = require('../controllers/ventaController');
const cajaController = require('../controllers/cajaController');
const reporteController = require('../controllers/reporteController');
const adminController = require('../controllers/adminController');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', '..', 'uploads', 'kiosco'));
    },
    filename: (req, file, cb) => {
        cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 1 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Solo imágenes PNG, JPG, JPEG, GIF'));
        }
    }
});

// === AUTENTICACIÓN ===
router.get('/login', authController.loginForm);
router.post('/login', authController.login);
router.get('/logout', isAuthenticated, authController.logout);
router.get('/debug', authController.debug);

// === DASHBOARD ===
router.get('/', isAuthenticated, dashboardController.index);

// === PRODUCTOS (admin y cajero pueden ver, solo admin modifica) ===
router.get('/productos', isAuthenticated, productoController.index);
router.get('/productos/nuevo', isAuthenticated, isAdmin, productoController.form);
router.get('/productos/:id/editar', isAuthenticated, isAdmin, productoController.form);
router.post('/productos/:id', isAuthenticated, isAdmin, productoController.save);
router.post('/productos', isAuthenticated, isAdmin, productoController.save);
router.post('/productos/:id/eliminar', isAuthenticated, isAdmin, productoController.delete);

// === VENTAS (cajero y admin) ===
router.get('/ventas', isAuthenticated, ventaController.pos);
router.get('/ventas/buscar', isAuthenticated, ventaController.buscarProducto);
router.post('/ventas', isAuthenticated, ventaController.registrar);
router.get('/ventas/historial', isAuthenticated, ventaController.historial);
router.get('/ventas/:id/detalle', isAuthenticated, ventaController.detalle);

// === CAJA (cajero y admin) ===
router.get('/caja', isAuthenticated, cajaController.index);
router.post('/caja/apertura', isAuthenticated, cajaController.apertura);
router.post('/caja/ingreso', isAuthenticated, cajaController.ingreso);
router.post('/caja/egreso', isAuthenticated, cajaController.egreso);
router.post('/caja/cierre', isAuthenticated, cajaController.cierre);
router.get('/caja/historial', isAuthenticated, cajaController.historial);

// === REPORTES (admin) ===
router.get('/reportes', isAuthenticated, isAdmin, reporteController.index);
router.get('/reportes/ventas/pdf', isAuthenticated, isAdmin, reporteController.pdfVentas);
router.get('/reportes/ventas/excel', isAuthenticated, isAdmin, reporteController.excelVentas);

// === ADMINISTRACIÓN (admin) ===
router.get('/admin/usuarios', isAuthenticated, isAdmin, adminController.usuarios);
router.post('/admin/usuarios', isAuthenticated, isAdmin, adminController.crearUsuario);
router.post('/admin/usuarios/:id/password', isAuthenticated, isAdmin, adminController.cambiarPassword);
router.post('/admin/usuarios/:id/toggle', isAuthenticated, isAdmin, adminController.toggleUsuario);
router.get('/admin/config', isAuthenticated, isAdmin, adminController.config);
router.post('/admin/config', isAuthenticated, isAdmin, upload.single('cfg_logo'), adminController.guardarConfig);
router.get('/admin/auditoria', isAuthenticated, isAdmin, adminController.auditoria);

module.exports = router;
