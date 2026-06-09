const sqlite3 = require("sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "presupuestos.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error al conectar con SQLite:", err.message);
  } else {
    console.log("SQLite conectado en:", dbPath);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS presupuestos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL,
      fecha TEXT NOT NULL,
      validez TEXT NOT NULL DEFAULT '30 días',
      cliente_nombre TEXT NOT NULL,
      cliente_apellido TEXT NOT NULL,
      cliente_cuit TEXT NOT NULL,
      cliente_telefono TEXT,
      cliente_direccion TEXT,
      empresa_nombre TEXT DEFAULT 'Nexus Tech',
      empresa_direccion TEXT DEFAULT '',
      empresa_telefono TEXT DEFAULT '',
      empresa_email TEXT DEFAULT '',
      empresa_web TEXT DEFAULT '',
      items TEXT NOT NULL,
      observaciones TEXT DEFAULT '',
      total_sin_iva REAL DEFAULT 0,
      total_iva REAL DEFAULT 0,
      total_final REAL DEFAULT 0,
      logo_path TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

function getAll(callback) {
  db.all("SELECT * FROM presupuestos ORDER BY created_at DESC", callback);
}

function getById(id, callback) {
  db.get("SELECT * FROM presupuestos WHERE id = ?", [id], callback);
}

function getNextNumero(callback) {
  db.get("SELECT COUNT(*) AS count FROM presupuestos", (err, row) => {
    if (err) return callback(err);
    const num = (row.count + 1).toString().padStart(4, "0");
    callback(null, { numero: `P-${num}` });
  });
}

function create(data, callback) {
  const {
    numero, fecha, validez,
    cliente_nombre, cliente_apellido, cliente_cuit, cliente_telefono, cliente_direccion,
    empresa_nombre, empresa_direccion, empresa_telefono, empresa_email, empresa_web,
    items, observaciones, total_sin_iva, total_iva, total_final, logo_path
  } = data;

  db.run(
    `INSERT INTO presupuestos (
      numero, fecha, validez,
      cliente_nombre, cliente_apellido, cliente_cuit, cliente_telefono, cliente_direccion,
      empresa_nombre, empresa_direccion, empresa_telefono, empresa_email, empresa_web,
      items, observaciones, total_sin_iva, total_iva, total_final, logo_path
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      numero, fecha, validez,
      cliente_nombre, cliente_apellido, cliente_cuit, cliente_telefono, cliente_direccion,
      empresa_nombre, empresa_direccion, empresa_telefono, empresa_email, empresa_web,
      JSON.stringify(items), observaciones, total_sin_iva, total_iva, total_final, logo_path
    ],
    function (err) {
      if (err) return callback(err);
      callback(null, { id: this.lastID, numero });
    }
  );
}

function search(query, callback) {
  db.all(
    "SELECT * FROM presupuestos WHERE cliente_nombre LIKE ? OR cliente_apellido LIKE ? OR numero LIKE ? ORDER BY created_at DESC",
    [`%${query}%`, `%${query}%`, `%${query}%`],
    callback
  );
}

module.exports = { db, getAll, getById, getNextNumero, create, search };
