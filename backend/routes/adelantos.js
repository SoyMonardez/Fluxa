const router = require('express').Router();
const z = require('zod');
const { pool, tx } = require('../db');
const { fail, id, fecha, texto, paramId } = require('../lib/http');
const { deudas } = require('../lib/cuentas');
const { estadoAdelantos } = require('../lib/calculos');

const adelantoSchema = z.object({
  obrero_id: id,
  monto: z.number().positive('El monto tiene que ser mayor a 0').max(1_000_000_000),
  fecha,
  nota: texto(255),
});

const deudaDe = async (db, obreroId) => (await deudas(db, [obreroId])).get(obreroId)?.deuda ?? 0;

router.get('/', async (req, res) => {
  const { obrero_id } = z.object({ obrero_id: id }).parse(req.query);
  const [rows] = await pool.query('SELECT id, tipo, monto, fecha, nota FROM adelantos WHERE obrero_id = ? ORDER BY id DESC', [obrero_id]);
  const estado = estadoAdelantos(rows, (await deudas(pool, [obrero_id])).get(obrero_id)?.descontado ?? 0);
  res.json(rows.map((a) => ({ ...a, ...estado.get(a.id) })));
});

router.post('/', async (req, res) => {
  const d = adelantoSchema.parse(req.body);
  const [[o]] = await pool.query('SELECT id FROM obreros WHERE id = ?', [d.obrero_id]);
  if (!o) fail(404, 'El obrero no existe.');
  const [r] = await pool.query("INSERT INTO adelantos (obrero_id, tipo, monto, fecha, nota) VALUES (?, 'adelanto', ?, ?, ?)", [
    d.obrero_id, d.monto, d.fecha, d.nota,
  ]);
  res.status(201).json({
    adelanto: { id: r.insertId, tipo: 'adelanto', ...d, descontado: 0, pendiente: d.monto },
    deuda: await deudaDe(pool, d.obrero_id),
  });
});

// Sólo se puede borrar si todavía no se descontó (ni en parte) en un pago.
router.delete('/:id', async (req, res) => {
  const adelantoId = paramId(req);
  const obreroId = await tx(async (c) => {
    const [[a]] = await c.query('SELECT id, obrero_id FROM adelantos WHERE id = ? FOR UPDATE', [adelantoId]);
    if (!a) fail(404, 'El adelanto no existe.');
    const [todos] = await c.query('SELECT id, monto FROM adelantos WHERE obrero_id = ?', [a.obrero_id]);
    const descontado = (await deudas(c, [a.obrero_id])).get(a.obrero_id)?.descontado ?? 0;
    if (estadoAdelantos(todos, descontado).get(a.id).descontado > 0) {
      fail(409, 'Ese adelanto ya se descontó en un pago. Para borrarlo, anulá ese pago.');
    }
    await c.query('DELETE FROM adelantos WHERE id = ?', [adelantoId]);
    return a.obrero_id;
  });
  res.json({ ok: true, obrero_id: obreroId, deuda: await deudaDe(pool, obreroId) });
});

module.exports = router;
