// Inventario (pañol) y reparto a cuadrillas.
// Total de la empresa = pañol + Σ lo que tiene cada cuadrilla. Cada cambio queda en herramienta_movs.
const router = require('express').Router();
const z = require('zod');
const { pool, tx } = require('../db');
const { fail, id, fecha, texto, dinero, paramId } = require('../lib/http');
const { stockDe } = require('../lib/equipos');
const { obreroConCuenta } = require('../lib/cuentas');
const { hoyLocal } = require('../lib/fechas');

const TIPOS = ['herramienta', 'maquina'];
const RECLAMOS = { robo: 'Robo', faltante: 'Faltante', rotura: 'Rotura por mal uso' };

const herramientaSchema = z.object({
  nombre: z.string().trim().min(1, 'Falta el nombre').max(120),
  tipo: z.enum(TIPOS).default('herramienta'),
  cantidad: z.number().int().min(0).max(100000),
  valor: dinero.default(0),
  nota: texto(255),
});

const cantidad = z.number().int().positive().max(100000);

async function cuadrillaActiva(c, cuadrillaId) {
  if (cuadrillaId == null) return null;
  const [[cuad]] = await c.query('SELECT id, nombre, encargado_id FROM cuadrillas WHERE id = ? AND activa = 1', [cuadrillaId]);
  if (!cuad) fail(404, 'La cuadrilla no existe.');
  return cuad;
}

async function herramientaBloqueada(c, herramientaId) {
  const [[h]] = await c.query('SELECT id, nombre, tipo, cantidad, valor, nota FROM herramientas WHERE id = ? AND activo = 1 FOR UPDATE', [herramientaId]);
  if (!h) fail(404, 'La herramienta no existe.');
  const [[s]] = await c.query('SELECT COALESCE(SUM(cantidad), 0) AS asignado FROM herramienta_stock WHERE herramienta_id = ?', [herramientaId]);
  return { ...h, asignado: Number(s.asignado), panol: h.cantidad - Number(s.asignado) };
}

async function enCuadrilla(c, herramientaId, cuadrillaId) {
  const [[s]] = await c.query('SELECT cantidad FROM herramienta_stock WHERE herramienta_id = ? AND cuadrilla_id = ? FOR UPDATE', [
    herramientaId, cuadrillaId,
  ]);
  return s?.cantidad ?? 0;
}

async function sumarStock(c, herramientaId, cuadrillaId, delta) {
  await c.query(
    `INSERT INTO herramienta_stock (herramienta_id, cuadrilla_id, cantidad) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE cantidad = cantidad + VALUES(cantidad)`,
    [herramientaId, cuadrillaId, delta]
  );
  await c.query('DELETE FROM herramienta_stock WHERE herramienta_id = ? AND cuadrilla_id = ? AND cantidad <= 0', [herramientaId, cuadrillaId]);
}

async function registrar(c, m) {
  const [r] = await c.query(
    `INSERT INTO herramienta_movs (herramienta_id, tipo, cantidad, desde_id, hacia_id, responsable_id, cargo, nota, fecha)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [m.herramienta_id, m.tipo, m.cantidad, m.desde_id ?? null, m.hacia_id ?? null, m.responsable_id ?? null, m.cargo ?? 0, m.nota ?? '', m.fecha]
  );
  return r.insertId;
}

const leerHerramienta = async (db, herramientaId) =>
  (await db.query('SELECT id, nombre, tipo, cantidad, valor, nota FROM herramientas WHERE id = ?', [herramientaId]))[0][0];

const respuesta = async (herramientaIds) => ({
  herramientas: await Promise.all(herramientaIds.map((h) => leerHerramienta(pool, h))),
  stock: await stockDe(pool, herramientaIds),
  herramienta_ids: herramientaIds,
});

// Alta. Opcional: mandarla directo a una cuadrilla.
router.post('/', async (req, res) => {
  const d = herramientaSchema.extend({ cantidad, cuadrilla_id: id.nullable().default(null), fecha: fecha.optional() }).parse(req.body);
  const dia = d.fecha ?? hoyLocal();
  const nuevaId = await tx(async (c) => {
    const cuad = await cuadrillaActiva(c, d.cuadrilla_id);
    const [r] = await c.query('INSERT INTO herramientas (nombre, tipo, cantidad, valor, nota) VALUES (?, ?, ?, ?, ?)', [
      d.nombre, d.tipo, d.cantidad, d.valor, d.nota,
    ]);
    await registrar(c, { herramienta_id: r.insertId, tipo: 'alta', cantidad: d.cantidad, fecha: dia });
    if (cuad) {
      await sumarStock(c, r.insertId, cuad.id, d.cantidad);
      await registrar(c, {
        herramienta_id: r.insertId, tipo: 'entrega', cantidad: d.cantidad, hacia_id: cuad.id, responsable_id: cuad.encargado_id, fecha: dia,
      });
    }
    return r.insertId;
  });
  res.status(201).json(await respuesta([nuevaId]));
});

// Edición. Cambiar la cantidad total queda registrado como alta (+) o ajuste (−).
router.put('/:id', async (req, res) => {
  const herramientaId = paramId(req);
  const d = herramientaSchema.extend({ motivo: texto(255) }).parse(req.body);
  await tx(async (c) => {
    const h = await herramientaBloqueada(c, herramientaId);
    if (d.cantidad < h.asignado) fail(409, `Hay ${h.asignado} en obras: el total no puede ser menor. Primero devolvelas al pañol.`);
    await c.query('UPDATE herramientas SET nombre = ?, tipo = ?, cantidad = ?, valor = ?, nota = ? WHERE id = ?', [
      d.nombre, d.tipo, d.cantidad, d.valor, d.nota, herramientaId,
    ]);
    const diff = d.cantidad - h.cantidad;
    if (diff !== 0) {
      await registrar(c, { herramienta_id: herramientaId, tipo: diff > 0 ? 'alta' : 'ajuste', cantidad: Math.abs(diff), nota: d.motivo, fecha: hoyLocal() });
    }
  });
  res.json(await respuesta([herramientaId]));
});

router.delete('/:id', async (req, res) => {
  const herramientaId = paramId(req);
  await tx(async (c) => {
    const h = await herramientaBloqueada(c, herramientaId);
    if (h.asignado > 0) fail(409, `Hay ${h.asignado} en obras. Devolvelas al pañol antes de borrarla.`);
    await c.query('UPDATE herramientas SET activo = 0 WHERE id = ?', [herramientaId]);
  });
  res.json({ ok: true, id: herramientaId });
});

// Entregar (pañol → cuadrilla), devolver (cuadrilla → pañol) o trasladar (cuadrilla → cuadrilla). Varias a la vez.
const moverSchema = z
  .object({
    desde: id.nullable(),
    hacia: id.nullable(),
    items: z.array(z.object({ herramienta_id: id, cantidad })).min(1).max(300),
    nota: texto(255),
    fecha: fecha.optional(),
  })
  .refine((d) => d.desde !== d.hacia, 'El origen y el destino son el mismo lugar');

router.post('/mover', async (req, res) => {
  const d = moverSchema.parse(req.body);
  const dia = d.fecha ?? hoyLocal();
  const ids = await tx(async (c) => {
    const desde = await cuadrillaActiva(c, d.desde);
    const hacia = await cuadrillaActiva(c, d.hacia);
    const tipo = !desde ? 'entrega' : !hacia ? 'devolucion' : 'traslado';
    const responsable = tipo === 'devolucion' ? desde.encargado_id : hacia.encargado_id;
    const tocadas = [];
    for (const it of d.items) {
      const h = await herramientaBloqueada(c, it.herramienta_id);
      const hay = desde ? await enCuadrilla(c, h.id, desde.id) : h.panol;
      if (hay < it.cantidad) fail(409, `No alcanza "${h.nombre}": en ${desde ? desde.nombre : 'el pañol'} hay ${hay}.`);
      if (desde) await sumarStock(c, h.id, desde.id, -it.cantidad);
      if (hacia) await sumarStock(c, h.id, hacia.id, it.cantidad);
      await registrar(c, {
        herramienta_id: h.id, tipo, cantidad: it.cantidad, desde_id: d.desde, hacia_id: d.hacia, responsable_id: responsable, nota: d.nota, fecha: dia,
      });
      tocadas.push(h.id);
    }
    return [...new Set(tocadas)];
  });
  res.json(await respuesta(ids));
});

// Reclamo: robo, faltante o rotura. Las unidades se dan de baja y queda a nombre del encargado.
// Opcional: cobrárselo (queda como cargo en su cuenta y se descuenta como un adelanto).
const reclamoSchema = z.object({
  herramienta_id: id,
  cuadrilla_id: id.nullable(),
  tipo: z.enum(Object.keys(RECLAMOS)),
  cantidad,
  nota: texto(255),
  fecha: fecha.optional(),
  cargo: z.object({ obrero_id: id, monto: z.number().positive().max(1_000_000_000) }).nullable().default(null),
});

router.post('/reclamo', async (req, res) => {
  const d = reclamoSchema.parse(req.body);
  const dia = d.fecha ?? hoyLocal();
  await tx(async (c) => {
    const cuad = await cuadrillaActiva(c, d.cuadrilla_id);
    const h = await herramientaBloqueada(c, d.herramienta_id);
    const hay = cuad ? await enCuadrilla(c, h.id, cuad.id) : h.panol;
    if (hay < d.cantidad) fail(409, `No alcanza "${h.nombre}": en ${cuad ? cuad.nombre : 'el pañol'} hay ${hay}.`);
    if (cuad) await sumarStock(c, h.id, cuad.id, -d.cantidad);
    await c.query('UPDATE herramientas SET cantidad = cantidad - ? WHERE id = ?', [d.cantidad, h.id]);
    const movId = await registrar(c, {
      herramienta_id: h.id,
      tipo: d.tipo,
      cantidad: d.cantidad,
      desde_id: cuad?.id ?? null,
      responsable_id: cuad?.encargado_id ?? null,
      cargo: d.cargo?.monto ?? 0,
      nota: d.nota,
      fecha: dia,
    });
    if (d.cargo) {
      const [[o]] = await c.query('SELECT id FROM obreros WHERE id = ?', [d.cargo.obrero_id]);
      if (!o) fail(400, 'El obrero a cobrar no existe.');
      const detalle = `${RECLAMOS[d.tipo]}: ${d.cantidad > 1 ? `${d.cantidad} × ` : ''}${h.nombre}${cuad ? ` (${cuad.nombre})` : ''}`;
      await c.query("INSERT INTO adelantos (obrero_id, tipo, monto, fecha, nota, movimiento_id) VALUES (?, 'cargo', ?, ?, ?, ?)", [
        d.cargo.obrero_id, d.cargo.monto, dia, detalle.slice(0, 255), movId,
      ]);
    }
  });
  const out = await respuesta([d.herramienta_id]);
  if (d.cargo) out.obrero = await obreroConCuenta(pool, d.cargo.obrero_id);
  res.json(out);
});

router.get('/movimientos', async (req, res) => {
  const q = z
    .object({
      herramienta_id: id.optional(),
      cuadrilla_id: id.optional(),
      limite: z.coerce.number().int().min(1).max(500).default(60),
    })
    .parse(req.query);
  const where = [];
  const params = [];
  if (q.herramienta_id) {
    where.push('m.herramienta_id = ?');
    params.push(q.herramienta_id);
  }
  if (q.cuadrilla_id) {
    where.push('(m.desde_id = ? OR m.hacia_id = ?)');
    params.push(q.cuadrilla_id, q.cuadrilla_id);
  }
  const [rows] = await pool.query(
    `SELECT m.id, m.herramienta_id, m.tipo, m.cantidad, m.desde_id, m.hacia_id, m.responsable_id, m.cargo, m.nota, m.fecha,
            h.nombre AS herramienta, h.tipo AS herramienta_tipo,
            cd.nombre AS desde_nombre, ch.nombre AS hacia_nombre, o.nombre AS responsable_nombre
       FROM herramienta_movs m
       JOIN herramientas h ON h.id = m.herramienta_id
       LEFT JOIN cuadrillas cd ON cd.id = m.desde_id
       LEFT JOIN cuadrillas ch ON ch.id = m.hacia_id
       LEFT JOIN obreros o ON o.id = m.responsable_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY m.fecha DESC, m.id DESC LIMIT ${q.limite}`,
    params
  );
  res.json(rows);
});

module.exports = router;
