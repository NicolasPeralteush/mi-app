const express = require("express");
const app = express();

app.get("/", (req, res) => {
  const ahora = new Date();
  const opciones = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  const fecha = ahora.toLocaleDateString("es-ES", opciones);
  const hora = ahora.toLocaleTimeString("es-ES");

  res.send(`
    <html>
      <head><title>Panel</title></head>
      <body style="font-family:sans-serif;text-align:center;padding-top:50px;">
        <h1>Panel de Fecha y Hora</h1>
        <p style="font-size:2rem;">${fecha}</p>
        <p style="font-size:2rem;">${hora}</p>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
});
