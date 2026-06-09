const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const Venta = require('../models/Venta');
const Caja = require('../models/Caja');

const reporteController = {
    async index(req, res) {
        try {
            const hoy = new Date();
            const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
            const finMes = hoy.toISOString().split('T')[0];

            const ventasPorDia = await Venta.getVentasPorDia(15);
            const ventasPorMes = await Venta.getVentasPorMes(12);
            const productosMasVendidos = await Venta.getProductosMasVendidos(10);
            const ganancia = await Venta.getGananciaEstimada(inicioMes, finMes);

            res.render('kiosco/reportes/index', {
                ventasPorDia,
                ventasPorMes,
                productosMasVendidos,
                ganancia: ganancia.toFixed(2),
                inicioMes,
                finMes,
                usuario: req.session.usuario
            });
        } catch (err) {
            console.error('Error en reportes:', err);
            res.status(500).render('kiosco/error', { mensaje: 'Error al cargar reportes' });
        }
    },

    async pdfVentas(req, res) {
        try {
            const desde = req.query.desde;
            const hasta = req.query.hasta;
            const ventas = await Venta.getAll(1, 1000, desde, hasta);

            const doc = new PDFDocument({ margin: 30, size: 'A4' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=ventas.pdf');
            doc.pipe(res);

            doc.fontSize(16).font('Helvetica-Bold').text('Reporte de Ventas', { align: 'center' });
            doc.moveDown();
            if (desde && hasta) {
                doc.fontSize(10).font('Helvetica').text(`Período: ${desde} al ${hasta}`, { align: 'center' });
            }
            doc.moveDown();

            const tableTop = doc.y;
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('ID', 30, tableTop);
            doc.text('Fecha', 70, tableTop);
            doc.text('Usuario', 180, tableTop);
            doc.text('Items', 310, tableTop);
            doc.text('Total', 370, tableTop);
            doc.moveDown();

            doc.font('Helvetica').fontSize(8);
            let y = doc.y;
            let totalGeneral = 0;
            for (const v of ventas.rows) {
                if (y > 750) { doc.addPage(); y = 30; }
                doc.text(v.id, 30, y);
                doc.text(new Date(v.fecha).toLocaleDateString('es-ES'), 70, y);
                doc.text(v.usuario_nombre || '-', 180, y);
                doc.text(String(v.cantidad_items), 310, y);
                doc.text(`$${parseFloat(v.total).toFixed(2)}`, 370, y);
                totalGeneral += parseFloat(v.total);
                y += 16;
            }

            doc.moveDown();
            doc.font('Helvetica-Bold').fontSize(10);
            doc.text(`Total General: $${totalGeneral.toFixed(2)}`, { align: 'right' });
            doc.end();
        } catch (err) {
            console.error('Error al generar PDF:', err);
            res.status(500).render('kiosco/error', { mensaje: 'Error al generar PDF' });
        }
    },

    async excelVentas(req, res) {
        try {
            const desde = req.query.desde;
            const hasta = req.query.hasta;
            const ventas = await Venta.getAll(1, 1000, desde, hasta);

            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Ventas');

            sheet.columns = [
                { header: 'ID', key: 'id', width: 8 },
                { header: 'Fecha', key: 'fecha', width: 18 },
                { header: 'Usuario', key: 'usuario', width: 20 },
                { header: 'Items', key: 'items', width: 10 },
                { header: 'Total', key: 'total', width: 12 }
            ];

            for (const v of ventas.rows) {
                sheet.addRow({
                    id: v.id,
                    fecha: new Date(v.fecha).toLocaleString('es-ES'),
                    usuario: v.usuario_nombre || '-',
                    items: v.cantidad_items,
                    total: parseFloat(v.total)
                });
            }

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=ventas.xlsx');
            await workbook.xlsx.write(res);
            res.end();
        } catch (err) {
            console.error('Error al generar Excel:', err);
            res.status(500).render('kiosco/error', { mensaje: 'Error al generar Excel' });
        }
    }
};

module.exports = reporteController;
