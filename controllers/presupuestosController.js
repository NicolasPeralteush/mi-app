const db = require("../database/db");
const pdfService = require("../services/pdfService");

const controller = {
  list(req, res) {
    const query = req.query.q || "";
    let presupuestos;

    try {
      if (query.trim()) {
        presupuestos = db.search(query.trim());
      } else {
        presupuestos = db.getAll();
      }
    } catch (err) {
      console.error("Error al listar presupuestos:", err);
      return res.status(500).send("Error al cargar presupuestos");
    }

    res.render("presupuestos", {
      presupuestos,
      searchQuery: query,
      formData: null,
      error: null,
    });
  },

  create(req, res) {
    const body = req.body;
    const logoPath = req.file ? req.file.path.replace(/\\/g, "/") : "";

    let items = [];
    try {
      if (body.items) {
        items = typeof body.items === "string" ? JSON.parse(body.items) : body.items;
      }
    } catch (e) {
      return res.render("presupuestos", {
        presupuestos: [],
        searchQuery: "",
        formData: body,
        error: "Error al procesar los items. Verifica el formato.",
      });
    }

    if (!items || items.length === 0) {
      return res.render("presupuestos", {
        presupuestos: [],
        searchQuery: "",
        formData: body,
        error: "Debe agregar al menos un producto o servicio.",
      });
    }

    const ivaTotal = items.reduce((sum, item) => {
      const subtotal = parseFloat(item.subtotal) || 0;
      const ivaPct = parseFloat(item.iva) || 0;
      return sum + (subtotal * ivaPct) / (100 + ivaPct);
    }, 0);

    const totalSinIva = items.reduce((sum, item) => {
      const subtotal = parseFloat(item.subtotal) || 0;
      const ivaPct = parseFloat(item.iva) || 0;
      const base = ivaPct > 0 ? subtotal / (1 + ivaPct / 100) : subtotal;
      return sum + base;
    }, 0);

    const totalFinal = items.reduce((sum, item) => sum + (parseFloat(item.subtotal) || 0), 0);

    try {
      const result = db.getNextNumero();

      const data = {
        numero: result.numero,
        fecha: body.fecha || new Date().toISOString().split("T")[0],
        validez: body.validez || "30 días",
        cliente_nombre: body.cliente_nombre || "",
        cliente_apellido: body.cliente_apellido || "",
        cliente_cuit: body.cliente_cuit || "",
        cliente_telefono: body.cliente_telefono || "",
        cliente_direccion: body.cliente_direccion || "",
        empresa_nombre: body.empresa_nombre || "Nexus Tech",
        empresa_direccion: body.empresa_direccion || "",
        empresa_telefono: body.empresa_telefono || "",
        empresa_email: body.empresa_email || "",
        empresa_web: body.empresa_web || "",
        items,
        observaciones: body.observaciones || "",
        total_sin_iva: totalSinIva.toFixed(2),
        total_iva: ivaTotal.toFixed(2),
        total_final: totalFinal.toFixed(2),
        logo_path: logoPath,
      };

      const saved = db.create(data);
      res.redirect(`/presupuestos/${saved.id}`);
    } catch (err) {
      console.error("Error al guardar:", err);
      return res.render("presupuestos", {
        presupuestos: [],
        searchQuery: "",
        formData: body,
        error: "Error al guardar el presupuesto en la base de datos.",
      });
    }
  },

  view(req, res) {
    const id = req.params.id;
    try {
      const presupuesto = db.getById(id);
      if (!presupuesto) {
        return res.status(404).send("Presupuesto no encontrado");
      }
      presupuesto.items = JSON.parse(presupuesto.items);
      res.render("presupuesto-view", { presupuesto });
    } catch (err) {
      return res.status(404).send("Presupuesto no encontrado");
    }
  },

  downloadPDF(req, res) {
    const id = req.params.id;
    try {
      const presupuesto = db.getById(id);
      if (!presupuesto) {
        return res.status(404).send("Presupuesto no encontrado");
      }
      presupuesto.items = JSON.parse(presupuesto.items);
      pdfService.generarPDF(presupuesto, res);
    } catch (err) {
      return res.status(404).send("Presupuesto no encontrado");
    }
  },
};

module.exports = controller;
