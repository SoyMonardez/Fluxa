// Datos de ejemplo para probar la app (NO usar en producción).
//   node scripts/seed.js          → carga el ejemplo si la base está vacía
//   node scripts/seed.js --reset  → borra todo (menos usuarios) y lo vuelve a cargar
require('dotenv').config({ quiet: true });
const { pool } = require('../db');
const { initDB } = require('./initDB');
const { liquidar, r2 } = require('../lib/calculos');
const { hoyLocal, sumarDias, semanaDePago, diaSemana } = require('../lib/fechas');

const TABLAS = ['herramienta_movs', 'herramienta_stock', 'herramientas', 'pago_items', 'adelantos', 'asistencias', 'pagos', 'obreros', 'cuadrillas'];

const CUADRILLAS = [
  { nombre: 'Plaza Funes', obra: 'Plaza principal · Funes', color: 'naranja' },
  { nombre: 'Roldán · Casa 4', obra: 'Tierra de Sueños 3, lote 112', color: 'azul' },
  { nombre: 'Pueblo Esther', obra: 'Galpón ruta 21 km 7', color: 'verde' },
];

// [nombre, rol, jornal, cuadrilla, encargado, teléfono]
const OBREROS = [
  ['Juan Pérez', 'Oficial', 45000, 0, true, '3416123456'],
  ['Carlos Gómez', 'Medio oficial', 38000, 0],
  ['Matías Ríos', 'Ayudante', 30000, 0],
  ['Lucas Fernández', 'Ayudante', 30000, 0],
  ['Ramón Díaz', 'Capataz', 55000, 1, true, '3415987654'],
  ['Diego Sosa', 'Oficial', 45000, 1],
  ['Hernán Rojas', 'Oficial', 46000, 1],
  ['Nicolás Acosta', 'Ayudante', 31000, 1],
  ['Brian Medina', 'Ayudante', 30000, 1],
  ['Sergio Molina', 'Oficial', 45000, 2, true],
  ['Pablo Benítez', 'Medio oficial', 38000, 2],
  ['Franco Ledesma', 'Ayudante', 30000, 2],
  ['Walter Ruiz', 'Ayudante', 30000, null],
];

// [nombre, tipo, total, valor, reparto por cuadrilla]
const HERRAMIENTAS = [
  ['Hormigonera 150 L', 'maquina', 2, 650000, [1, 1, 0]],
  ['Martillo demoledor', 'maquina', 1, 600000, [0, 1, 0]],
  ['Generador 5 kVA', 'maquina', 1, 900000, [0, 0, 1]],
  ['Vibrador de hormigón', 'maquina', 1, 450000, [0, 0, 0]],
  ['Amoladora 9"', 'herramienta', 4, 120000, [1, 1, 0]],
  ['Amoladora 4½"', 'herramienta', 3, 70000, [1, 0, 1]],
  ['Taladro percutor', 'herramienta', 3, 95000, [1, 1, 1]],
  ['Rotomartillo', 'herramienta', 2, 280000, [0, 1, 0]],
  ['Cortadora de cerámica', 'herramienta', 2, 90000, [0, 1, 0]],
  ['Andamio (cuerpo)', 'herramienta', 20, 85000, [8, 8, 0]],
  ['Carretilla', 'herramienta', 6, 75000, [2, 2, 1]],
  ['Pala ancha', 'herramienta', 12, 18000, [4, 4, 2]],
  ['Pala de punta', 'herramienta', 8, 18000, [2, 3, 2]],
  ['Balde albañil', 'herramienta', 20, 4000, [6, 6, 4]],
  ['Nivel 60 cm', 'herramienta', 5, 15000, [1, 2, 1]],
  ['Escalera 7 escalones', 'herramienta', 3, 110000, [1, 1, 0]],
];

// Pseudoaleatorio estable para que el ejemplo sea siempre igual.
const azar = (a, b) => ((a * 9301 + b * 49297 + 7) % 233280) / 233280;

function jornadaDe(i, dia, n) {
  const x = azar(i + 1, n + 3);
  if (x < 0.08) return 0; // falta
  if (x > 0.95) return 2; // doble
  if (x > 0.9) return 1.5; // medio día más
  return 1;
}

async function main() {
  const reset = process.argv.includes('--reset');
  await initDB();
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM obreros');
  if (n > 0 && !reset) {
    console.log('Ya hay datos cargados. Usá --reset para borrar todo y cargar el ejemplo.');
    return;
  }
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of TABLAS) await conn.query(`TRUNCATE TABLE ${t}`);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }

  const hoy = hoyLocal();
  const actual = semanaDePago(hoy);
  const anterior = semanaDePago(sumarDias(actual.desde, -1));

  const cuadIds = [];
  for (const c of CUADRILLAS) {
    const [r] = await pool.query('INSERT INTO cuadrillas (nombre, obra, color) VALUES (?, ?, ?)', [c.nombre, c.obra, c.color]);
    cuadIds.push(r.insertId);
  }

  const obreros = [];
  for (const [nombre, rol, jornal, cuad, encargado, telefono = ''] of OBREROS) {
    const cid = cuad == null ? null : cuadIds[cuad];
    const [r] = await pool.query('INSERT INTO obreros (nombre, rol, jornal, telefono, cuadrilla_id) VALUES (?, ?, ?, ?, ?)', [
      nombre, rol, jornal, telefono, cid,
    ]);
    if (encargado) await pool.query('UPDATE cuadrillas SET encargado_id = ? WHERE id = ?', [r.insertId, cid]);
    obreros.push({ id: r.insertId, nombre, jornal, cuad });
  }
  const porNombre = (nom) => obreros.find((o) => o.nombre.startsWith(nom));

  // Asistencia: semana anterior completa + semana actual hasta hoy.
  // Hoy sólo se pasó lista en dos cuadrillas (para ver cómo queda el resto sin marcar).
  const marcar = async (dia, filtro = () => true) => {
    const dow = diaSemana(dia);
    if (dow === 0) return; // domingo
    for (const [i, o] of obreros.entries()) {
      if (!filtro(o)) continue;
      if (dow === 6 && o.cuad !== 1) continue; // los sábados sólo trabaja Roldán
      const j = dow === 6 ? 0.5 : jornadaDe(i, dia, Number(dia.slice(-2)));
      if (j > 0) await pool.query('INSERT INTO asistencias (obrero_id, fecha, jornales) VALUES (?, ?, ?)', [o.id, dia, j]);
    }
  };
  for (let d = anterior.desde; d <= anterior.hasta; d = sumarDias(d, 1)) await marcar(d);
  for (let d = actual.desde; d < hoy && d <= actual.hasta; d = sumarDias(d, 1)) await marcar(d);
  if (hoy <= actual.hasta) await marcar(hoy, (o) => o.cuad === 0 || o.cuad === 1);

  // Adelantos: uno ya descontado la semana pasada y varios de esta semana.
  const adelanto = (nom, monto, dia, nota = '') =>
    pool.query("INSERT INTO adelantos (obrero_id, tipo, monto, fecha, nota) VALUES (?, 'adelanto', ?, ?, ?)", [porNombre(nom).id, monto, dia, nota]);
  await adelanto('Diego', 40000, sumarDias(anterior.desde, 4), 'Para el alquiler');

  // Pago de la semana anterior (descontando todo).
  const [pend] = await pool.query('SELECT id, obrero_id, fecha, jornales FROM asistencias WHERE fecha <= ? ORDER BY fecha', [anterior.hasta]);
  const filas = [];
  for (const o of obreros) {
    const dias = pend.filter((a) => a.obrero_id === o.id);
    if (!dias.length) continue;
    const jornales = r2(dias.reduce((s, a) => s + Number(a.jornales), 0));
    const deuda = o.nombre.startsWith('Diego') ? 40000 : 0;
    filas.push({ o, dias, jornales, ...liquidar({ jornales, jornal: o.jornal, deuda }) });
  }
  const tot = (k) => r2(filas.reduce((s, f) => s + f[k], 0));
  const [p] = await pool.query(
    'INSERT INTO pagos (hasta, fecha, total_bruto, total_plus, total_descuentos, total_neto) VALUES (?, ?, ?, 0, ?, ?)',
    [anterior.hasta, anterior.hasta, tot('bruto'), tot('descuento'), tot('neto')]
  );
  for (const f of filas) {
    await pool.query(
      'INSERT INTO pago_items (pago_id, obrero_id, desde, dias, jornales, jornal, bruto, plus, descuento, neto) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)',
      [p.insertId, f.o.id, f.dias[0].fecha, f.dias.length, f.jornales, f.o.jornal, f.bruto, f.descuento, f.neto]
    );
    await pool.query('UPDATE asistencias SET pago_id = ? WHERE id IN (?)', [p.insertId, f.dias.map((a) => a.id)]);
  }

  const lunes = sumarDias(actual.desde, 2);
  const enSemana = (n) => (sumarDias(lunes, n) <= hoy ? sumarDias(lunes, n) : hoy);
  await adelanto('Juan', 30000, enSemana(1));
  await adelanto('Matías', 20000, enSemana(2), 'Remedios');
  await adelanto('Diego', 50000, enSemana(3));

  // Herramientas y reparto.
  const enc = async (cuad) => (await pool.query('SELECT encargado_id FROM cuadrillas WHERE id = ?', [cuadIds[cuad]]))[0][0].encargado_id;
  const inicio = sumarDias(anterior.desde, -20);
  for (const [nombre, tipo, total, valor, reparto] of HERRAMIENTAS) {
    const [r] = await pool.query('INSERT INTO herramientas (nombre, tipo, cantidad, valor) VALUES (?, ?, ?, ?)', [nombre, tipo, total, valor]);
    await pool.query("INSERT INTO herramienta_movs (herramienta_id, tipo, cantidad, fecha) VALUES (?, 'alta', ?, ?)", [r.insertId, total, inicio]);
    for (const [i, cant] of reparto.entries()) {
      if (!cant) continue;
      await pool.query('INSERT INTO herramienta_stock (herramienta_id, cuadrilla_id, cantidad) VALUES (?, ?, ?)', [r.insertId, cuadIds[i], cant]);
      await pool.query(
        "INSERT INTO herramienta_movs (herramienta_id, tipo, cantidad, hacia_id, responsable_id, fecha) VALUES (?, 'entrega', ?, ?, ?, ?)",
        [r.insertId, cant, cuadIds[i], await enc(i), sumarDias(inicio, i + 1)]
      );
    }
  }

  // Un reclamo: amoladora rota en Roldán, cobrada al encargado.
  const [[amo]] = await pool.query("SELECT id FROM herramientas WHERE nombre = 'Amoladora 9\"'");
  const ramon = porNombre('Ramón').id;
  await pool.query('UPDATE herramienta_stock SET cantidad = cantidad - 1 WHERE herramienta_id = ? AND cuadrilla_id = ?', [amo.id, cuadIds[1]]);
  await pool.query('DELETE FROM herramienta_stock WHERE cantidad <= 0');
  await pool.query('UPDATE herramientas SET cantidad = cantidad - 1 WHERE id = ?', [amo.id]);
  const [mov] = await pool.query(
    "INSERT INTO herramienta_movs (herramienta_id, tipo, cantidad, desde_id, responsable_id, cargo, nota, fecha) VALUES (?, 'rotura', 1, ?, ?, 25000, 'Se usó sin la protección', ?)",
    [amo.id, cuadIds[1], ramon, enSemana(2)]
  );
  await pool.query("INSERT INTO adelantos (obrero_id, tipo, monto, fecha, nota, movimiento_id) VALUES (?, 'cargo', 25000, ?, ?, ?)", [
    ramon, enSemana(2), 'Rotura por mal uso: Amoladora 9" (Roldán · Casa 4)', mov.insertId,
  ]);

  console.log(`Ejemplo cargado: ${obreros.length} obreros, ${CUADRILLAS.length} cuadrillas, ${HERRAMIENTAS.length} herramientas.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
