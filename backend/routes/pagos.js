// Pagos semanales (corte el viernes). Se pagan todos los días sin pagar hasta el corte,
// así que si quedó algo de semanas anteriores, entra solo.
const router = require('express').Router();
const z = require('zod');
const { pool, tx } = require('../db');
const { fail, id, fecha, texto, paramId } = require('../lib/http');
const { deudas } = require('../lib/cuentas');
const { liquidar, r2 } = require('../lib/calculos');
const { semanaDePago } = require('../lib/fechas');

const sumar = (arr, k) => r2(arr.reduce((s, x) => s + Number(x[k] || 0), 0));

function agrupar(rows) {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r.obrero_id)) m.set(r.obrero_id, []);
    m.get(r.obrero_id).push(r);
  }
  return m;
}

router.get('/preview', async (req, res) => {
  const { hasta } = z.object({ hasta: fecha }).parse(req.query);
  const [[asist], [obreros], deuda] = await Promise.all([
    pool.query('SELECT obrero_id, fecha, jornales FROM asistencias WHERE pago_id IS NULL AND fecha <= ? ORDER BY fecha', [hasta]),
    pool.query('SELECT id, nombre, rol, jornal, telefono, cuadrilla_id, activo FROM obreros ORDER BY nombre'),
    deudas(pool),
  ]);
  const porObrero = agrupar(asist);
  const items = [];
  const sinDias = [];
  for (const o of obreros) {
    const dias = porObrero.get(o.id);
    const d = deuda.get(o.id)?.deuda ?? 0;
    if (!dias) {
      if (o.activo && d > 0) sinDias.push({ obrero_id: o.id, nombre: o.nombre, rol: o.rol, deuda: d });
      continue;
    }
    const jornales = r2(dias.reduce((s, a) => s + Number(a.jornales), 0));
    items.push({
      obrero_id: o.id,
      nombre: o.nombre,
      rol: o.rol,
      telefono: o.telefono,
      cuadrilla_id: o.cuadrilla_id,
      activo: Boolean(o.activo),
      jornal: o.jornal,
      dias: dias.length,
      jornales,
      desde: dias[0].fecha,
      asistencias: dias.map((a) => ({ fecha: a.fecha, jornales: Number(a.jornales) })),
      deuda: d,
      ...liquidar({ jornales, jornal: o.jornal, deuda: d }),
    });
  }
  res.json({ hasta, semana: semanaDePago(hasta), items, sin_dias: sinDias });
});

const pagoSchema = z.object({
  hasta: fecha,
  fecha,
  nota: texto(255),
  items: z
    .array(
      z.object({
        obrero_id: id,
        descuento: z.number().min(0),
        plus: z.number().min(0).max(1_000_000_000).default(0),
        nota: texto(255),
      })
    )
    .min(1, 'No hay obreros para pagar')
    .max(500),
});

router.post('/', async (req, res) => {
  const d = pagoSchema.parse(req.body);
  const ids = [...new Set(d.items.map((i) => i.obrero_id))];
  const pagoId = await tx(async (c) => {
    // Se bloquean los días a pagar para que nadie los pague dos veces.
    const [asist] = await c.query(
      'SELECT id, obrero_id, fecha, jornales FROM asistencias WHERE pago_id IS NULL AND fecha <= ? AND obrero_id IN (?) ORDER BY fecha FOR UPDATE',
      [d.hasta, ids]
    );
    const [obreros] = await c.query('SELECT id, jornal FROM obreros WHERE id IN (?)', [ids]);
    const jornalDe = new Map(obreros.map((o) => [o.id, o.jornal]));
    const deuda = await deudas(c, ids);
    const porObrero = agrupar(asist);

    const filas = [];
    for (const it of d.items) {
      const dias = porObrero.get(it.obrero_id);
      if (!dias || filas.some((f) => f.obrero_id === it.obrero_id)) continue;
      const jornales = r2(dias.reduce((s, a) => s + Number(a.jornales), 0));
      const jornal = jornalDe.get(it.obrero_id);
      const calc = liquidar({ jornales, jornal, deuda: deuda.get(it.obrero_id)?.deuda ?? 0, plus: it.plus, descuento: it.descuento });
      filas.push({ obrero_id: it.obrero_id, desde: dias[0].fecha, dias: dias.length, jornales, jornal, ...calc, nota: it.nota, ids: dias.map((a) => a.id) });
    }
    if (!filas.length) fail(400, 'No hay días pendientes para pagar.');

    const [p] = await c.query(
      'INSERT INTO pagos (hasta, fecha, total_bruto, total_plus, total_descuentos, total_neto, nota) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [d.hasta, d.fecha, sumar(filas, 'bruto'), sumar(filas, 'plus'), sumar(filas, 'descuento'), sumar(filas, 'neto'), d.nota]
    );
    await c.query(
      'INSERT INTO pago_items (pago_id, obrero_id, desde, dias, jornales, jornal, bruto, plus, descuento, neto, nota) VALUES ?',
      [filas.map((f) => [p.insertId, f.obrero_id, f.desde, f.dias, f.jornales, f.jornal, f.bruto, f.plus, f.descuento, f.neto, f.nota])]
    );
    await c.query('UPDATE asistencias SET pago_id = ? WHERE id IN (?)', [p.insertId, filas.flatMap((f) => f.ids)]);
    return p.insertId;
  });
  res.status(201).json(await detalle(pool, pagoId));
});

router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.id, p.hasta, p.fecha, p.total_bruto, p.total_plus, p.total_descuentos, p.total_neto, p.nota,
            COUNT(i.id) AS obreros, COALESCE(SUM(i.jornales), 0) AS jornales
       FROM pagos p LEFT JOIN pago_items i ON i.pago_id = p.id
      GROUP BY p.id ORDER BY p.fecha DESC, p.id DESC LIMIT 200`
  );
  res.json(rows);
});

async function detalle(db, pagoId) {
  const [[pago]] = await db.query('SELECT * FROM pagos WHERE id = ?', [pagoId]);
  if (!pago) fail(404, 'El pago no existe.');
  const [[items], [dias]] = await Promise.all([
    db.query(
      `SELECT i.*, o.nombre, o.rol, o.telefono FROM pago_items i JOIN obreros o ON o.id = i.obrero_id
        WHERE i.pago_id = ? ORDER BY o.nombre`,
      [pagoId]
    ),
    db.query('SELECT obrero_id, fecha, jornales FROM asistencias WHERE pago_id = ? ORDER BY fecha', [pagoId]),
  ]);
  const porObrero = agrupar(dias);
  return {
    ...pago,
    items: items.map((i) => ({
      ...i,
      asistencias: (porObrero.get(i.obrero_id) || []).map((a) => ({ fecha: a.fecha, jornales: Number(a.jornales) })),
    })),
  };
}

router.get('/:id', async (req, res) => {
  res.json(await detalle(pool, paramId(req)));
});

// Anular: los días vuelven a estar sin pagar y los adelantos descontados vuelven a la deuda.
router.delete('/:id', async (req, res) => {
  const pagoId = paramId(req);
  await tx(async (c) => {
    const [[p]] = await c.query('SELECT id FROM pagos WHERE id = ? FOR UPDATE', [pagoId]);
    if (!p) fail(404, 'El pago no existe.');
    await c.query('UPDATE asistencias SET pago_id = NULL WHERE pago_id = ?', [pagoId]);
    await c.query('DELETE FROM pagos WHERE id = ?', [pagoId]);
  });
  res.json({ ok: true });
});

module.exports = router;
