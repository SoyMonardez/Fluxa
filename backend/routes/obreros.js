const router = require('express').Router();
const z = require('zod');
const { pool, tx } = require('../db');
const { fail, id, texto, dinero, paramId } = require('../lib/http');
const { deudas, obreroConCuenta } = require('../lib/cuentas');
const { estadoAdelantos } = require('../lib/calculos');
const { hoyLocal, sumarDias } = require('../lib/fechas');
const { equipos } = require('../lib/equipos');

// Toda modificación devuelve el obrero con su cuenta y las cuadrillas (puede cambiar el encargado).
const respuesta = async (obreroId) => ({
  obrero: await obreroConCuenta(pool, obreroId),
  cuadrillas: (await equipos(pool)).cuadrillas,
});

const obreroSchema = z.object({
  nombre: z.string().trim().min(1, 'Falta el nombre').max(100),
  rol: z.string().trim().min(1).max(40),
  jornal: dinero,
  telefono: texto(40),
  nota: texto(255),
  cuadrilla_id: id.nullable().default(null),
});

async function asegurarCuadrilla(db, cuadrillaId) {
  if (cuadrillaId == null) return;
  const [[c]] = await db.query('SELECT id FROM cuadrillas WHERE id = ? AND activa = 1', [cuadrillaId]);
  if (!c) fail(400, 'La cuadrilla no existe.');
}

router.post('/', async (req, res) => {
  const d = obreroSchema.parse(req.body);
  await asegurarCuadrilla(pool, d.cuadrilla_id);
  const [r] = await pool.query(
    'INSERT INTO obreros (nombre, rol, jornal, telefono, nota, cuadrilla_id) VALUES (?, ?, ?, ?, ?, ?)',
    [d.nombre, d.rol, d.jornal, d.telefono, d.nota, d.cuadrilla_id]
  );
  res.status(201).json(await respuesta(r.insertId));
});

router.put('/:id', async (req, res) => {
  const obreroId = paramId(req);
  const d = obreroSchema.parse(req.body);
  await tx(async (c) => {
    const [[prev]] = await c.query('SELECT cuadrilla_id FROM obreros WHERE id = ? FOR UPDATE', [obreroId]);
    if (!prev) fail(404, 'El obrero no existe.');
    await asegurarCuadrilla(c, d.cuadrilla_id);
    await c.query(
      'UPDATE obreros SET nombre = ?, rol = ?, jornal = ?, telefono = ?, nota = ?, cuadrilla_id = ? WHERE id = ?',
      [d.nombre, d.rol, d.jornal, d.telefono, d.nota, d.cuadrilla_id, obreroId]
    );
    // Si se fue de la cuadrilla, deja de ser su encargado.
    if (prev.cuadrilla_id !== d.cuadrilla_id) {
      await c.query('UPDATE cuadrillas SET encargado_id = NULL WHERE encargado_id = ? AND id <> ?', [obreroId, d.cuadrilla_id ?? 0]);
    }
  });
  res.json(await respuesta(obreroId));
});

// Baja: no se borra (tiene historia de días y pagos), sólo deja de aparecer.
router.delete('/:id', async (req, res) => {
  const obreroId = paramId(req);
  await tx(async (c) => {
    const [r] = await c.query('UPDATE obreros SET activo = 0, cuadrilla_id = NULL WHERE id = ?', [obreroId]);
    if (!r.affectedRows) fail(404, 'El obrero no existe.');
    await c.query('UPDATE cuadrillas SET encargado_id = NULL WHERE encargado_id = ?', [obreroId]);
  });
  res.json(await respuesta(obreroId));
});

router.post('/:id/alta', async (req, res) => {
  const obreroId = paramId(req);
  const [r] = await pool.query('UPDATE obreros SET activo = 1 WHERE id = ?', [obreroId]);
  if (!r.affectedRows) fail(404, 'El obrero no existe.');
  res.json(await respuesta(obreroId));
});

// Ficha: días (sin pagar + últimos 90), adelantos con su estado y pagos recibidos.
router.get('/:id/cuenta', async (req, res) => {
  const obreroId = paramId(req);
  const obrero = await obreroConCuenta(pool, obreroId);
  if (!obrero) fail(404, 'El obrero no existe.');
  const desde = sumarDias(hoyLocal(), -90);
  const [[asistencias], [adelantos], [pagos], deuda] = await Promise.all([
    pool.query(
      `SELECT fecha, jornales, nota, pago_id FROM asistencias
        WHERE obrero_id = ? AND (pago_id IS NULL OR fecha >= ?) ORDER BY fecha DESC`,
      [obreroId, desde]
    ),
    pool.query('SELECT id, tipo, monto, fecha, nota FROM adelantos WHERE obrero_id = ? ORDER BY id DESC', [obreroId]),
    pool.query(
      `SELECT i.pago_id, p.fecha, p.hasta, i.desde, i.dias, i.jornales, i.jornal, i.bruto, i.plus, i.descuento, i.neto
         FROM pago_items i JOIN pagos p ON p.id = i.pago_id
        WHERE i.obrero_id = ? ORDER BY p.fecha DESC, p.id DESC LIMIT 30`,
      [obreroId]
    ),
    deudas(pool, [obreroId]),
  ]);
  const estado = estadoAdelantos(adelantos, deuda.get(obreroId)?.descontado ?? 0);
  res.json({
    obrero,
    asistencias: asistencias.map(({ pago_id, ...a }) => ({ ...a, pagado: pago_id != null })),
    adelantos: adelantos.map((a) => ({ ...a, ...estado.get(a.id) })),
    pagos,
  });
});

module.exports = router;
