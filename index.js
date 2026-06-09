const express = require("express");
const path = require("path");
const session = require("express-session");
const MySQLStore = require('express-mysql-session')(session);
const helmet = require("helmet");

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionStore = new MySQLStore({
    host: process.env.K_DB_HOST || process.env.DB_HOST || 'localhost',
    user: process.env.K_DB_USER || process.env.DB_USER || 'root',
    password: process.env.K_DB_PASS || process.env.DB_PASS || '',
    database: process.env.K_DB_NAME || process.env.DB_NAME || 'sql10829811',
    port: parseInt(process.env.K_DB_PORT || process.env.DB_PORT || 3306),
    createDatabaseTable: true,
    schema: {
        tableName: 'ksc_sessions',
        columnNames: {
            session_id: 'id',
            expires: 'expires',
            data: 'data'
        }
    }
});

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'kiosco-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 8 * 60 * 60 * 1000 }
}));

const presupuestosRouter = require("./routes/presupuestos");
app.use("/presupuestos", presupuestosRouter);

const kioscoRouter = require("./kiosco/routes/kiosco");
app.use("/kiosco", kioscoRouter);

const menuItems = [
  { label: "Beneficios", href: "#beneficios" },
  { label: "Servicios", href: "#servicios" },
  { label: "Características", href: "#caracteristicas" },
  { label: "Testimonios", href: "#testimonios" },
  { label: "FAQ", href: "#faq" },
  { label: "Contacto", href: "#contacto" },
];

const servicios = [
  {
    icon: "bi-window-stack",
    title: "Desarrollo Web",
    desc: "Creamos sitios web modernos, responsivos y optimizados para convertir visitantes en clientes. Tecnologías como React, Node.js y Bootstrap.",
  },
  {
    icon: "bi-robot",
    title: "Automatizaciones con IA",
    desc: "Integramos inteligencia artificial para automatizar procesos repetitivos, ahorrando tiempo y reduciendo costos operativos en tu empresa.",
  },
  {
    icon: "bi-chat-dots",
    title: "Chatbots para WhatsApp",
    desc: "Chatbots inteligentes para WhatsApp que atienden a tus clientes 24/7, generan leads y resuelven consultas al instante.",
  },
  {
    icon: "bi-gear-wide-connected",
    title: "Sistemas Empresariales",
    desc: "Desarrollamos sistemas CRM, ERP y paneles de control a medida para digitalizar y escalar tu negocio.",
  },
];

const beneficios = [
  {
    icon: "bi-rocket-takeoff",
    title: "Resultados Rápidos",
    desc: "Implementaciones ágiles con metodologías modernas para ver resultados en semanas, no meses.",
  },
  {
    icon: "bi-shield-check",
    title: "Calidad Garantizada",
    desc: "Código limpio, pruebas automatizadas y estándares de calidad para un producto robusto y seguro.",
  },
  {
    icon: "bi-headset",
    title: "Soporte Dedicado",
    desc: "Acompañamiento continuo con soporte técnico prioritario y sesiones de capacitación.",
  },
  {
    icon: "bi-arrow-up-circle",
    title: "Escalabilidad",
    desc: "Arquitecturas preparadas para crecer contigo, desde una startup hasta una empresa corporativa.",
  },
];

const caracteristicas = [
  {
    icon: "bi-lightning-charge",
    title: "Rendimiento Óptimo",
    desc: "Carga rápida gracias a optimización de recursos, lazy loading y CDN integrado.",
  },
  {
    icon: "bi-search-heart",
    title: "SEO Avanzado",
    desc: "Estructura semántica, meta tags Open Graph y datos estructurados para mejor posicionamiento.",
  },
  {
    icon: "bi-phone",
    title: "100% Responsive",
    desc: "Diseño adaptativo que se ve perfecto en cualquier dispositivo: móvil, tablet o desktop.",
  },
  {
    icon: "bi-palette",
    title: "Diseño Moderno",
    desc: "Interfaces atractivas con Bootstrap 5, animaciones suaves y experiencia de usuario intuitiva.",
  },
  {
    icon: "bi-shield-lock",
    title: "Seguridad",
    desc: "Protección de datos, cifrado SSL y buenas prácticas de seguridad en cada desarrollo.",
  },
  {
    icon: "bi-graph-up-arrow",
    title: "Analítica",
    desc: "Integración con herramientas de analítica para medir y mejorar continuamente tus resultados.",
  },
];

const testimonios = [
  {
    text: "Transformaron nuestra atención al cliente con un chatbot para WhatsApp. Ahora resolvemos el 80% de consultas automáticamente.",
    name: "María García",
    role: "CEO, TechSolutions",
    rating: 5,
  },
  {
    text: "El sistema empresarial que desarrollaron optimizó nuestros procesos internos. Redujimos costos operativos en un 40%.",
    name: "Carlos Mendoza",
    role: "Director de Operaciones, Grupo Logístico",
    rating: 5,
  },
  {
    text: "Nuestra página web cuadruplicó las conversiones gracias al rediseño y la optimización SEO que implementaron.",
    name: "Ana López",
    role: "Marketing Manager, InnovaShop",
    rating: 5,
  },
];

const faqs = [
  {
    q: "¿Cuánto tiempo toma desarrollar un sitio web?",
    a: "Dependiendo de la complejidad, un sitio web profesional puede estar listo en 2 a 4 semanas. Proyectos más complejos como sistemas empresariales pueden tomar de 6 a 12 semanas.",
  },
  {
    q: "¿Ofrecen mantenimiento después del desarrollo?",
    a: "Sí, contamos con planes de mantenimiento mensual que incluyen actualizaciones, respaldos, monitoreo y soporte técnico prioritario.",
  },
  {
    q: "¿Qué tecnologías utilizan para los chatbots?",
    a: "Usamos las APIs oficiales de WhatsApp Business, combinadas con inteligencia artificial (OpenAI, Google Dialogflow) y Node.js para crear experiencias conversacionales naturales.",
  },
  {
    q: "¿Cómo funcionan las automatizaciones con IA?",
    a: "Analizamos tus procesos actuales, identificamos tareas repetitivas y diseñamos flujos automatizados usando RPA, machine learning y APIs. No requieres conocimientos técnicos.",
  },
  {
    q: "¿Ofrecen facturación y garantía?",
    a: "Sí, emitimos factura fiscal para todos nuestros servicios. Todos los proyectos incluyen 30 días de garantía post-entrega para ajustes y correcciones.",
  },
];

app.get("/", (req, res) => {
  res.render("index", {
    title: "Nexus Tech - Desarrollo Web, IA, Chatbots y Sistemas Empresariales",
    description:
      "Transformamos tu negocio con desarrollo web moderno, automatizaciones con IA, chatbots inteligentes para WhatsApp y sistemas empresariales a medida.",
    menuItems,
    servicios,
    beneficios,
    caracteristicas,
    testimonios,
    faqs,
  });
});

app.post("/contacto", (req, res) => {
  const { nombre, email, telefono, mensaje } = req.body;
  console.log("Nuevo contacto:", { nombre, email, telefono, mensaje });
  res.redirect("/#contacto?enviado=ok");
});

app.get("/sitemap.xml", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "sitemap.xml"));
});

app.get("/robots.txt", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "robots.txt"));
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
