const db = require("../database/db");
const pdfService = require("../services/pdfService");

const controller = {
  list(req, res) {
    const query = req.query.q || "";

    const renderList = (err, presupuestos) => {
      if (err) {
        console.error("Error al listar presupuestos:", err);
        return res.status(500).send("Error al cargar presupuestos");
      }
      res.render("presupuestos", {
        presupuestos,
        searchQuery: query,
        formData: null,
        error: null,
      });
    };

    if (query.trim()) {
      db.search(query.trim(), renderList);
    } else {
      db.getAll(renderList);
    }
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

    db.getNextNumero((err, result) => {
      if (err) {
        return res.render("presupuestos", {
          presupuestos: [],
          searchQuery: "",
          formData: body,
          error: "Error al generar número de presupuesto.",
        });
      }

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

      db.create(data, (err, result) => {
        if (err) {
          console.error("Error al guardar:", err);
          return res.render("presupuestos", {
            presupuestos: [],
            searchQuery: "",
            formData: body,
            error: "Error al guardar el presupuesto en la base de datos.",
          });
        }
        res.redirect(`/presupuestos/${result.id}`);
      });
    });
  },

  view(req, res) {
    const id = req.params.id;
    db.getById(id, (err, presupuesto) => {
      if (err || !presupuesto) {
        return res.status(404).send("Presupuesto no encontrado");
      }
      try {
        presupuesto.items = JSON.parse(presupuesto.items);
      } catch {
        presupuesto.items = [];
      }
      res.render("presupuesto-view", { presupuesto });
    });
  },

  downloadPDF(req, res) {
    const id = req.params.id;
    db.getById(id, (err, presupuesto) => {
      if (err || !presupuesto) {
        return res.status(404).send("Presupuesto no encontrado");
      }
      try {
        presupuesto.items = JSON.parse(presupuesto.items);
      } catch {
        presupuesto.items = [];
      }
      pdfService.generarPDF(presupuesto, res);
    });
  },
};

module.exports = controller;
