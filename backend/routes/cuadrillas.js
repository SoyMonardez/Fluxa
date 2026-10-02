const router = require('express').Router();
const z = require('zod');
const { pool, tx } = require('../db');
const { fail, id, texto, paramId } = require('../lib/http');
const { equipos, stockDe } = require('../lib/equipos');
const { hoyLocal } = require('../lib/fechas');

const COLORES = ['naranja', 'azul', 'verde', 'violeta', 'rosa', 'celeste', 'amarillo', 'gris'];

const cuadrillaSchema = z.object({
  nombre: z.string().trim().min(1, 'Falta el nombre').max(80),
  obra: texto(160),
  color: z.enum(COLORES).default('naranja'),
  encargado_id: id.nullable().default(null),
});

async function cuadrillaActiva(c, cuadrillaId) {
  const [[cuad]] = await c.query('SELECT id, encargado_id FROM cuadrillas WHERE id = ? AND activa = 1 FOR UPDATE', [cuadrillaId]);
  if (!cuad) fail(404, 'La cuadrilla no existe.');
  return cuad;
}

// El encargado tiene que ser integrante: si no lo es, se lo suma a la cuadrilla.
async function ponerEncargado(c, cuadrillaId, obreroId) {
  if (obreroId == null) return;
  const [[o]] = await c.query('SELECT id FROM obreros WHERE id = ? AND activo = 1', [obreroId]);
  if (!o) fail(400, 'El encargado elegido no existe.');
  await c.query('UPDATE cuadrillas SET encargado_id = NULL WHERE encargado_id = ? AND id <> ?', [obreroId, cuadrillaId]);
  await c.query('UPDATE obreros SET cuadrilla_id = ? WHERE id = ?', [cuadrillaId, obreroId]);
}

router.post('/', async (req, res) => {
  const d = cuadrillaSchema.parse(req.body);
  const nuevaId = await tx(async (c) => {
    const [r] = await c.query('INSERT INTO cuadrillas (nombre, obra, color, encargado_id) VALUES (?, ?, ?, ?)', [
      d.nombre, d.obra, d.color, d.encargado_id,
    ]);
    await ponerEncargado(c, r.insertId, d.encargado_id);
    return r.insertId;
  });
  res.status(201).json({ id: nuevaId, ...(await equipos(pool)) });
});

router.put('/:id', async (req, res) => {
  const cuadrillaId = paramId(req);
  const d = cuadrillaSchema.parse(req.body);
  await tx(async (c) => {
    await cuadrillaActiva(c, cuadrillaId);
    await c.query('UPDATE cuadrillas SET nombre = ?, obra = ?, color = ?, encargado_id = ? WHERE id = ?', [
      d.nombre, d.obra, d.color, d.encargado_id, cuadrillaId,
    ]);
    await ponerEncargado(c, cuadrillaId, d.encargado_id);
  });
  res.json(await equipos(pool));
});

// Define la lista completa de integrantes. Quien estaba en otra cuadrilla se mueve.
router.put('/:id/integrantes', async (req, res) => {
  const cuadrillaId = paramId(req);
  const { obrero_ids: ids } = z.object({ obrero_ids: z.array(id).max(300) }).parse(req.body);
  await tx(async (c) => {
    const cuad = await cuadrillaActiva(c, cuadrillaId);
    await c.query('UPDATE obreros SET cuadrilla_id = NULL WHERE cuadrilla_id = ? AND id NOT IN (?)', [
      cuadrillaId, ids.length ? ids : [0],
    ]);
    if (ids.length) {
      await c.query('UPDATE cuadrillas SET encargado_id = NULL WHERE encargado_id IN (?) AND id <> ?', [ids, cuadrillaId]);
      await c.query('UPDATE obreros SET cuadrilla_id = ? WHERE id IN (?) AND activo = 1', [cuadrillaId, ids]);
    }
    if (cuad.encargado_id && !ids.includes(cuad.encargado_id)) {
      await c.query('UPDATE cuadrillas SET encargado_id = NULL WHERE id = ?', [cuadrillaId]);
    }
  });
  res.json(await equipos(pool));
});

// Cerrar cuadrilla: herramientas vuelven al pañol y los integrantes quedan libres.
router.delete('/:id', async (req, res) => {
  const cuadrillaId = paramId(req);
  const fecha = hoyLocal();
  const herramientas = await tx(async (c) => {
    const cuad = await cuadrillaActiva(c, cuadrillaId);
    const [stock] = await c.query(
      'SELECT herramienta_id, cantidad FROM herramienta_stock WHERE cuadrilla_id = ? AND cantidad > 0 FOR UPDATE',
      [cuadrillaId]
    );
    for (const s of stock) {
      await c.query(
        `INSERT INTO herramienta_movs (herramienta_id, tipo, cantidad, desde_id, hacia_id, responsable_id, nota, fecha)
         VALUES (?, 'devolucion', ?, ?, NULL, ?, 'Cierre de cuadrilla', ?)`,
        [s.herramienta_id, s.cantidad, cuadrillaId, cuad.encargado_id, fecha]
      );
    }
    await c.query('DELETE FROM herramienta_stock WHERE cuadrilla_id = ?', [cuadrillaId]);
    await c.query('UPDATE obreros SET cuadrilla_id = NULL WHERE cuadrilla_id = ?', [cuadrillaId]);
    await c.query('UPDATE cuadrillas SET activa = 0, encargado_id = NULL WHERE id = ?', [cuadrillaId]);
    return stock.map((s) => s.herramienta_id);
  });
  res.json({ ...(await equipos(pool)), stock: await stockDe(pool), devueltas: herramientas.length });
});

module.exports = router;
module.exports.COLORES = COLORES;
