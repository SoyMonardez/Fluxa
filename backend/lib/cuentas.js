// Consultas de "cuenta" de los obreros: deuda de adelantos y días sin pagar.
const { r2, deudaDe } = require('./calculos');

const filtroIds = (ids, col = 'obrero_id') => (ids ? ` AND ${col} IN (?)` : '');

/** Map(obrero_id → { adelantos, descontado, deuda }) */
async function deudas(db, ids = null) {
  if (ids && ids.length === 0) return new Map();
  const params = ids ? [ids] : [];
  const [[adel], [desc]] = await Promise.all([
    db.query(`SELECT obrero_id, SUM(monto) AS total FROM adelantos WHERE 1=1${filtroIds(ids)} GROUP BY obrero_id`, params),
    db.query(`SELECT obrero_id, SUM(descuento) AS total FROM pago_items WHERE 1=1${filtroIds(ids)} GROUP BY obrero_id`, params),
  ]);
  const out = new Map();
  for (const r of adel) out.set(r.obrero_id, { adelantos: r2(r.total), descontado: 0 });
  for (const r of desc) {
    const x = out.get(r.obrero_id) || { adelantos: 0, descontado: 0 };
    x.descontado = r2(r.total);
    out.set(r.obrero_id, x);
  }
  for (const x of out.values()) x.deuda = deudaDe(x.adelantos, x.descontado);
  return out;
}

/** Map(obrero_id → { dias, jornales, desde }) de asistencias sin pagar */
async function pendientes(db, ids = null) {
  if (ids && ids.length === 0) return new Map();
  const [rows] = await db.query(
    `SELECT obrero_id, COUNT(*) AS dias, SUM(jornales) AS jornales, MIN(fecha) AS desde
       FROM asistencias WHERE pago_id IS NULL${filtroIds(ids)} GROUP BY obrero_id`,
    ids ? [ids] : []
  );
  return new Map(rows.map((r) => [r.obrero_id, { dias: r.dias, jornales: Number(r.jornales), desde: r.desde }]));
}

function conCuenta(o, deuda, pend) {
  const p = pend.get(o.id);
  return {
    ...o,
    activo: Boolean(o.activo),
    deuda: deuda.get(o.id)?.deuda ?? 0,
    pend_dias: p?.dias ?? 0,
    pend_jornales: p?.jornales ?? 0,
    pend_desde: p?.desde ?? null,
  };
}

const COLS_OBRERO = 'id, nombre, rol, jornal, telefono, nota, cuadrilla_id, activo';

async function obreroConCuenta(db, id) {
  const [[o]] = await db.query(`SELECT ${COLS_OBRERO} FROM obreros WHERE id = ?`, [id]);
  if (!o) return null;
  const [deuda, pend] = await Promise.all([deudas(db, [id]), pendientes(db, [id])]);
  return conCuenta(o, deuda, pend);
}

module.exports = { deudas, pendientes, conCuenta, obreroConCuenta, COLS_OBRERO };
