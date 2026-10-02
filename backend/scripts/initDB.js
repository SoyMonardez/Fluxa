// Crea la base y las tablas (idempotente). Se ejecuta en cada arranque del contenedor.
// Si encuentra tablas del sistema anterior, las renombra a legacy_* (no borra datos).
require('dotenv').config({ quiet: true });
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { config } = require('../db');

const DB = process.env.DB_NAME || 'etem_management';
const OPCIONES = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

// Tablas del sistema anterior que ya no se usan.
const LEGACY = ['comprobantes', 'ingresos_obra', 'gastos_proveedor', 'asignaciones', 'proyectos', 'trabajadores'];

const TABLAS = [
  `CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL
  ) ${OPCIONES}`,

  `CREATE TABLE IF NOT EXISTS cuadrillas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    obra VARCHAR(160) NOT NULL DEFAULT '',
    color VARCHAR(16) NOT NULL DEFAULT 'naranja',
    encargado_id INT NULL,
    activa TINYINT(1) NOT NULL DEFAULT 1,
    creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ${OPCIONES}`,

  `CREATE TABLE IF NOT EXISTS obreros (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    rol VARCHAR(40) NOT NULL DEFAULT 'Ayudante',
    jornal DECIMAL(12,2) NOT NULL DEFAULT 0,
    telefono VARCHAR(40) NOT NULL DEFAULT '',
    nota VARCHAR(255) NOT NULL DEFAULT '',
    cuadrilla_id INT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_obreros_cuadrilla (cuadrilla_id),
    CONSTRAINT fk_obreros_cuadrilla FOREIGN KEY (cuadrilla_id) REFERENCES cuadrillas(id) ON DELETE SET NULL
  ) ${OPCIONES}`,

  `CREATE TABLE IF NOT EXISTS pagos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hasta DATE NOT NULL,
    fecha DATE NOT NULL,
    total_bruto DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_plus DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_descuentos DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_neto DECIMAL(14,2) NOT NULL DEFAULT 0,
    nota VARCHAR(255) NOT NULL DEFAULT '',
    creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ${OPCIONES}`,

  `CREATE TABLE IF NOT EXISTS asistencias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    obrero_id INT NOT NULL,
    fecha DATE NOT NULL,
    jornales DECIMAL(3,1) NOT NULL DEFAULT 1.0,
    nota VARCHAR(255) NOT NULL DEFAULT '',
    pago_id INT NULL,
    actualizado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_asistencia_obrero_fecha (obrero_id, fecha),
    KEY idx_asistencia_fecha (fecha),
    KEY idx_asistencia_pago (pago_id),
    CONSTRAINT fk_asistencia_obrero FOREIGN KEY (obrero_id) REFERENCES obreros(id) ON DELETE CASCADE,
    CONSTRAINT fk_asistencia_pago FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE SET NULL
  ) ${OPCIONES}`,

  `CREATE TABLE IF NOT EXISTS adelantos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    obrero_id INT NOT NULL,
    tipo ENUM('adelanto','cargo') NOT NULL DEFAULT 'adelanto',
    monto DECIMAL(12,2) NOT NULL,
    fecha DATE NOT NULL,
    nota VARCHAR(255) NOT NULL DEFAULT '',
    movimiento_id INT NULL,
    creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_adelantos_obrero (obrero_id),
    CONSTRAINT fk_adelanto_obrero FOREIGN KEY (obrero_id) REFERENCES obreros(id) ON DELETE CASCADE
  ) ${OPCIONES}`,

  `CREATE TABLE IF NOT EXISTS pago_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pago_id INT NOT NULL,
    obrero_id INT NOT NULL,
    desde DATE NULL,
    dias INT NOT NULL DEFAULT 0,
    jornales DECIMAL(6,1) NOT NULL DEFAULT 0,
    jornal DECIMAL(12,2) NOT NULL DEFAULT 0,
    bruto DECIMAL(12,2) NOT NULL DEFAULT 0,
    plus DECIMAL(12,2) NOT NULL DEFAULT 0,
    descuento DECIMAL(12,2) NOT NULL DEFAULT 0,
    neto DECIMAL(12,2) NOT NULL DEFAULT 0,
    nota VARCHAR(255) NOT NULL DEFAULT '',
    KEY idx_items_obrero (obrero_id),
    CONSTRAINT fk_item_pago FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_obrero FOREIGN KEY (obrero_id) REFERENCES obreros(id) ON DELETE CASCADE
  ) ${OPCIONES}`,

  `CREATE TABLE IF NOT EXISTS herramientas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    tipo ENUM('herramienta','maquina') NOT NULL DEFAULT 'herramienta',
    cantidad INT NOT NULL DEFAULT 1,
    valor DECIMAL(12,2) NOT NULL DEFAULT 0,
    nota VARCHAR(255) NOT NULL DEFAULT '',
    activo TINYINT(1) NOT NULL DEFAULT 1,
    creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ${OPCIONES}`,

  `CREATE TABLE IF NOT EXISTS herramienta_stock (
    herramienta_id INT NOT NULL,
    cuadrilla_id INT NOT NULL,
    cantidad INT NOT NULL,
    PRIMARY KEY (herramienta_id, cuadrilla_id),
    KEY idx_stock_cuadrilla (cuadrilla_id),
    CONSTRAINT fk_stock_herramienta FOREIGN KEY (herramienta_id) REFERENCES herramientas(id) ON DELETE CASCADE,
    CONSTRAINT fk_stock_cuadrilla FOREIGN KEY (cuadrilla_id) REFERENCES cuadrillas(id) ON DELETE CASCADE
  ) ${OPCIONES}`,

  `CREATE TABLE IF NOT EXISTS herramienta_movs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    herramienta_id INT NOT NULL,
    tipo ENUM('alta','ajuste','entrega','devolucion','traslado','robo','faltante','rotura') NOT NULL,
    cantidad INT NOT NULL,
    desde_id INT NULL,
    hacia_id INT NULL,
    responsable_id INT NULL,
    cargo DECIMAL(12,2) NOT NULL DEFAULT 0,
    nota VARCHAR(255) NOT NULL DEFAULT '',
    fecha DATE NOT NULL,
    creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_movs_herramienta (herramienta_id),
    KEY idx_movs_desde (desde_id),
    KEY idx_movs_hacia (hacia_id),
    CONSTRAINT fk_mov_herramienta FOREIGN KEY (herramienta_id) REFERENCES herramientas(id) ON DELETE CASCADE
  ) ${OPCIONES}`,
];

async function existe(conn, tabla) {
  const [[r]] = await conn.query(
    'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
    [DB, tabla]
  );
  return r.n > 0;
}

async function tieneColumna(conn, tabla, columna) {
  const [[r]] = await conn.query(
    'SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
    [DB, tabla, columna]
  );
  return r.n > 0;
}

async function archivarLegacy(conn) {
  const viejas = [...LEGACY];
  // La tabla "asistencias" vieja era por obra (tenía proyecto_id).
  if ((await existe(conn, 'asistencias')) && (await tieneColumna(conn, 'asistencias', 'proyecto_id'))) viejas.push('asistencias');
  for (const t of viejas) {
    if (!(await existe(conn, t))) continue;
    if (await existe(conn, `legacy_${t}`)) {
      console.warn(`  ! ${t} y legacy_${t} existen las dos; se deja ${t} como está.`);
      continue;
    }
    await conn.query(`RENAME TABLE \`${t}\` TO \`legacy_${t}\``);
    console.log(`  · tabla vieja ${t} → legacy_${t}`);
  }
}

// Si había trabajadores en el sistema anterior, se copian (una sola vez) con su último jornal.
async function migrarTrabajadores(conn) {
  if (!(await existe(conn, 'legacy_trabajadores'))) return;
  const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM obreros');
  if (n > 0) return;
  const jornal = (await existe(conn, 'legacy_asignaciones'))
    ? `COALESCE((SELECT a.pago_jornal FROM legacy_asignaciones a WHERE a.trabajador_id = t.id
                 ORDER BY a.activo DESC, a.fecha_desde DESC, a.id DESC LIMIT 1), 0)`
    : '0';
  const [r] = await conn.query(
    `INSERT INTO obreros (nombre, rol, jornal, activo)
     SELECT t.nombre, IF(t.rol = 'Medio Oficial', 'Medio oficial', LEFT(t.rol, 40)), ${jornal}, t.activo
       FROM legacy_trabajadores t ORDER BY t.id`
  );
  if (r.affectedRows) console.log(`  · ${r.affectedRows} obreros copiados del sistema anterior`);
}

async function crearAdmin(conn) {
  const [rows] = await conn.query('SELECT id FROM usuarios WHERE username = ?', ['admin']);
  if (rows.length) return;
  const clave = process.env.ADMIN_PASSWORD;
  if (!clave) throw new Error('Falta ADMIN_PASSWORD para crear el usuario admin.');
  await conn.query('INSERT INTO usuarios (username, password_hash) VALUES (?, ?)', ['admin', await bcrypt.hash(clave, 10)]);
  console.log('  · usuario admin creado');
}

async function initDB() {
  const conn = await mysql.createConnection(config);
  try {
    console.log(`Preparando base ${DB}...`);
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${DB}\``);
    await archivarLegacy(conn);
    for (const sql of TABLAS) await conn.query(sql);
    await migrarTrabajadores(conn);
    await crearAdmin(conn);
    console.log('Base lista.');
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  initDB().catch((err) => {
    console.error('Error preparando la base:', err.message);
    process.exit(1);
  });
}

module.exports = { initDB };
