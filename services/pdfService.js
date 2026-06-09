const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

function generarPDF(presupuesto, res) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    info: {
      Title: `Presupuesto ${presupuesto.numero}`,
      Author: presupuesto.empresa_nombre || "Nexus Tech",
      Subject: "Presupuesto",
    },
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=presupuesto-${presupuesto.numero}.pdf`);
  doc.pipe(res);

  const items = typeof presupuesto.items === "string"
    ? JSON.parse(presupuesto.items)
    : presupuesto.items;

  const pageWidth = doc.page.width - 100;
  const marginX = 50;
  const primaryColor = "#6c5ce7";
  const grayColor = "#f5f5f5";
  const textColor = "#333333";

  const top = (y) => y;

  doc.fontSize(8).fillColor("#999").text(`Pág. ${1}`, marginX, 10, { align: "right", width: pageWidth });

  const drawHeader = () => {
    const logoPath = presupuesto.logo_path
      ? path.join(__dirname, "..", presupuesto.logo_path)
      : null;

    if (logoPath && fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, marginX, 30, { width: 80 });
      } catch (e) {
      }
    }

    const headerTop = 50;

    doc.fontSize(20).font("Helvetica-Bold").fillColor(primaryColor)
      .text(presupuesto.empresa_nombre || "Nexus Tech", marginX, headerTop, { align: "right" });

    const companyY = headerTop + 25;
    doc.fontSize(9).font("Helvetica").fillColor("#666")
      .text(
        [
          presupuesto.empresa_direccion,
          presupuesto.empresa_telefono,
          presupuesto.empresa_email,
          presupuesto.empresa_web,
        ]
          .filter(Boolean)
          .join(" | "),
        marginX, companyY,
        { align: "right", width: pageWidth }
      );

    const lineY = companyY + 20;
    doc.moveTo(marginX, lineY).lineTo(marginX + pageWidth, lineY).strokeColor(primaryColor).lineWidth(2).stroke();

    return lineY + 30;
  };

  let currentY = drawHeader();

  doc.fontSize(22).font("Helvetica-Bold").fillColor(textColor)
    .text("PRESUPUESTO", marginX, currentY, { align: "left" });

  currentY += 40;

  doc.fontSize(10).font("Helvetica-Bold").fillColor(primaryColor)
    .text("N°:", marginX, currentY, { continued: true })
    .font("Helvetica").fillColor(textColor)
    .text(` ${presupuesto.numero}`);

  doc.fontSize(10).font("Helvetica-Bold").fillColor(primaryColor)
    .text("Fecha:", marginX + 200, currentY, { continued: true })
    .font("Helvetica").fillColor(textColor)
    .text(` ${presupuesto.fecha}`);

  doc.fontSize(10).font("Helvetica-Bold").fillColor(primaryColor)
    .text("Validez:", marginX + 350, currentY, { continued: true })
    .font("Helvetica").fillColor(textColor)
    .text(` ${presupuesto.validez}`);

  currentY += 30;

  const boxY = currentY;
  doc.roundedRect(marginX, boxY, pageWidth, 70, 5).fill(grayColor);

  doc.fillColor(textColor);
  doc.fontSize(10).font("Helvetica-Bold")
    .text("DATOS DEL CLIENTE", marginX + 10, boxY + 10);

  doc.fontSize(10).font("Helvetica-Bold").fillColor(primaryColor)
    .text("Cliente:", marginX + 10, boxY + 30, { continued: true })
    .font("Helvetica").fillColor(textColor)
    .text(` ${presupuesto.cliente_nombre} ${presupuesto.cliente_apellido}`);

  doc.fontSize(10).font("Helvetica-Bold").fillColor(primaryColor)
    .text("CUIT:", marginX + 10, boxY + 45, { continued: true })
    .font("Helvetica").fillColor(textColor)
    .text(` ${presupuesto.cliente_cuit}`);

  if (presupuesto.cliente_telefono) {
    doc.fontSize(10).font("Helvetica-Bold").fillColor(primaryColor)
      .text("Tel:", marginX + 220, boxY + 30, { continued: true })
      .font("Helvetica").fillColor(textColor)
      .text(` ${presupuesto.cliente_telefono}`);
  }

  if (presupuesto.cliente_direccion) {
    doc.fontSize(10).font("Helvetica-Bold").fillColor(primaryColor)
      .text("Dir:", marginX + 220, boxY + 45, { continued: true })
      .font("Helvetica").fillColor(textColor)
      .text(` ${presupuesto.cliente_direccion}`);
  }

  currentY = boxY + 90;

  const tableTop = currentY;
  doc.fontSize(10).font("Helvetica-Bold").fillColor(textColor)
    .text("DETALLE DE PRODUCTOS / SERVICIOS", marginX, tableTop);

  currentY = tableTop + 25;

  const colDesc = marginX;
  const colCant = marginX + 250;
  const colPrecio = marginX + 310;
  const colIva = marginX + 380;
  const colSubtotal = marginX + 440;

  doc.rect(marginX, currentY - 5, pageWidth, 22).fill(primaryColor);

  doc.fontSize(9).font("Helvetica-Bold").fillColor("white");
  doc.text("Descripción", colDesc + 5, currentY, { width: 240 });
  doc.text("Cant.", colCant, currentY, { width: 50, align: "center" });
  doc.text("P. Unit.", colPrecio, currentY, { width: 65, align: "right" });
  doc.text("IVA %", colIva, currentY, { width: 55, align: "center" });
  doc.text("Subtotal", colSubtotal, currentY, { width: 55, align: "right" });

  currentY += 22;

  items.forEach((item, i) => {
    const bgColor = i % 2 === 0 ? grayColor : "white";
    doc.rect(marginX, currentY - 5, pageWidth, 20).fill(bgColor);

    doc.fontSize(9).font("Helvetica").fillColor(textColor);
    doc.text(item.descripcion || "", colDesc + 5, currentY, { width: 240 });
    doc.text(String(item.cantidad || 0), colCant, currentY, { width: 50, align: "center" });
    doc.text(`$${parseFloat(item.precio_unitario || 0).toFixed(2)}`, colPrecio, currentY, { width: 65, align: "right" });
    doc.text(`${item.iva || 0}%`, colIva, currentY, { width: 55, align: "center" });
    doc.text(`$${parseFloat(item.subtotal || 0).toFixed(2)}`, colSubtotal, currentY, { width: 55, align: "right" });

    currentY += 20;
  });

  currentY += 10;

  const totalsX = marginX + 280;
  const totalsWidth = pageWidth - 280;
  doc.fontSize(10);

  doc.font("Helvetica").fillColor(textColor)
    .text("Subtotal sin IVA:", totalsX, currentY, { width: 120, align: "left" });
  doc.font("Helvetica-Bold").fillColor(textColor)
    .text(`$${parseFloat(presupuesto.total_sin_iva || 0).toFixed(2)}`, totalsX + 120, currentY,
      { width: 80, align: "right" });
  currentY += 20;

  doc.font("Helvetica").fillColor(textColor)
    .text("IVA total:", totalsX, currentY, { width: 120, align: "left" });
  doc.font("Helvetica-Bold").fillColor(textColor)
    .text(`$${parseFloat(presupuesto.total_iva || 0).toFixed(2)}`, totalsX + 120, currentY,
      { width: 80, align: "right" });
  currentY += 20;

  doc.rect(totalsX, currentY - 5, 200, 28).fill(primaryColor);
  doc.fontSize(12).font("Helvetica-Bold").fillColor("white")
    .text("TOTAL:", totalsX + 5, currentY, { width: 100, align: "left" });
  doc.text(`$${parseFloat(presupuesto.total_final || 0).toFixed(2)}`, totalsX + 5, currentY,
    { width: 195, align: "right" });
  currentY += 40;

  if (presupuesto.observaciones) {
    doc.fontSize(9).font("Helvetica-Bold").fillColor(primaryColor)
      .text("OBSERVACIONES:", marginX, currentY);
    currentY += 15;
    doc.font("Helvetica").fillColor(textColor)
      .text(presupuesto.observaciones, marginX, currentY, { width: pageWidth });
    currentY += 30;
  }

  currentY += 20;
  doc.moveTo(marginX, currentY).lineTo(marginX + pageWidth, currentY)
    .strokeColor("#ccc").lineWidth(1).stroke();
  currentY += 10;

  doc.fontSize(10).font("Helvetica-Bold").fillColor(primaryColor)
    .text("FIRMA Y CONFORMIDAD", marginX, currentY);
  currentY += 20;
  doc.fontSize(9).font("Helvetica").fillColor(textColor)
    .text("___________________________", marginX, currentY);
  doc.text("Aclaración / Firma", marginX, currentY + 15, { width: 200 });

  doc.fontSize(9).font("Helvetica").fillColor(textColor)
    .text("___________________________", marginX + 250, currentY);
  doc.text("Aclaración / Firma", marginX + 250, currentY + 15, { width: 200 });

  currentY = doc.page.height - 50;

  doc.fontSize(8).fillColor("#999")
    .text(
      `${presupuesto.empresa_nombre || "Nexus Tech"} - Presupuesto ${presupuesto.numero}`,
      marginX, currentY,
      { align: "left", width: pageWidth }
    )
    .text(
      `Generado el ${new Date().toLocaleDateString("es-ES")}`,
      marginX, currentY,
      { align: "right", width: pageWidth }
    );

  doc.end();
}

module.exports = { generarPDF };
