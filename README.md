# Nexus Tech - Landing Page Profesional

Landing page corporativa moderna y responsive para servicios de desarrollo web, automatizaciones con IA, chatbots para WhatsApp y sistemas empresariales.

## Tecnologías

- **Node.js** + **Express.js**
- **EJS** (template engine)
- **Bootstrap 5.3**
- **Bootstrap Icons**
- **CSS3** con animaciones
- **JavaScript Vanilla**

## Despliegue en Render

1. Conecta tu repositorio de GitHub a Render
2. Selecciona **Web Service**
3. Configura:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Render asignará automáticamente el puerto via `process.env.PORT`

## Estructura

```
mi-app/
├── index.js              # Servidor Express
├── package.json
├── README.md
├── views/
│   ├── index.ejs         # Landing page principal
│   └── partials/
│       ├── navbar.ejs    # Navbar responsive
│       └── footer.ejs    # Footer profesional
├── public/
│   ├── css/
│   │   └── styles.css    # Estilos personalizados
│   ├── js/
│   │   └── main.js       # JavaScript interactivo
│   ├── img/
│   │   ├── favicon.svg
│   │   └── hero-illustration.svg
│   ├── sitemap.xml
│   └── robots.txt
```

## Comandos

```bash
npm install     # Instalar dependencias
npm start       # Iniciar servidor (producción)
npm run dev     # Iniciar con auto-reload (desarrollo)
```
