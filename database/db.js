const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "presupuestos.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS presupuestos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT NOT NULL,
    fecha TEXT NOT NULL,
    validez TEXT NOT NULL DEFAULT '30 d\u00edas',
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

function getAll() {
  return db.prepare("SELECT * FROM presupuestos ORDER BY created_at DESC").all();
}

function getById(id) {
  return db.prepare("SELECT * FROM presupuestos WHERE id = ?").get(id);
}

function getNextNumero() {
  const row = db.prepare("SELECT COUNT(*) AS count FROM presupuestos").get();
  const num = String(row.count + 1).padStart(4, "0");
  return { numero: `P-${num}` };
}

function create(data) {
  const stmt = db.prepare(`
    INSERT INTO presupuestos (
      numero, fecha, validez,
      cliente_nombre, cliente_apellido, cliente_cuit, cliente_telefono, cliente_direccion,
      empresa_nombre, empresa_direccion, empresa_telefono, empresa_email, empresa_web,
      items, observaciones, total_sin_iva, total_iva, total_final, logo_path
    ) VALUES (
      @numero, @fecha, @validez,
      @cliente_nombre, @cliente_apellido, @cliente_cuit, @cliente_telefono, @cliente_direccion,
      @empresa_nombre, @empresa_direccion, @empresa_telefono, @empresa_email, @empresa_web,
      @items, @observaciones, @total_sin_iva, @total_iva, @total_final, @logo_path
    )
  `);
  const info = stmt.run({ ...data, items: JSON.stringify(data.items) });
  return { id: info.lastInsertRowid, numero: data.numero };
}

function search(query) {
  const q = `%${query}%`;
  return db
    .prepare(
      "SELECT * FROM presupuestos WHERE cliente_nombre LIKE ? OR cliente_apellido LIKE ? OR numero LIKE ? ORDER BY created_at DESC"
    )
    .all(q, q, q);
}

module.exports = { db, getAll, getById, getNextNumero, create, search };
