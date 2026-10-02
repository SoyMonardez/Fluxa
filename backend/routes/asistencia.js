// Asistencia general (no por obra): un registro por obrero por día.
// Falta = no hay registro. Un día pagado no se puede modificar.
const router = require('express').Router();
const z = require('zod');
const { pool, tx } = require('../db');
const { fail, id, fecha } = require('../lib/http');
const { sumarDias } = require('../lib/fechas');

const JORNADAS = [0, 0.5, 1, 1.5, 2];
const jornales = z.number().refine((v) => JORNADAS.includes(v), 'Jornada inválida (0, ½, 1, 1½ o 2)');

const marcaSchema = z.object({
  obrero_id: id,
  fecha,
  jornales,
  nota: z.string().trim().max(255).optional(),
});

const loteSchema = z.object({
  fecha,
  items: z.array(z.object({ obrero_id: id, jornales })).min(1).max(300),
});

const fila = (r) => ({
  obrero_id: r.obrero_id,
  fecha: r.fecha,
  jornales: Number(r.jornales),
  nota: r.nota,
  pagado: r.pago_id != null,
});

router.get('/', async (req, res) => {
  const { desde, hasta } = z.object({ desde: fecha, hasta: fecha }).parse(req.query);
  if (hasta < desde || sumarDias(desde, 120) < hasta) fail(400, 'Rango de fechas inválido (máximo 120 días).');
  const [rows] = await pool.query(
    'SELECT obrero_id, fecha, jornales, nota, pago_id FROM asistencias WHERE fecha BETWEEN ? AND ?',
    [desde, hasta]
  );
  res.json(rows.map(fila));
});

// Devuelve { registro } con el estado final del día (null = falta), o { bloqueado } si ya estaba pagado.
async function marcar(db, { obrero_id, fecha: dia, jornales: j, nota }) {
  if (j === 0) {
    const [r] = await db.query('DELETE FROM asistencias WHERE obrero_id = ? AND fecha = ? AND pago_id IS NULL', [obrero_id, dia]);
    if (r.affectedRows) return { registro: null };
  } else {
    const notaSql = nota === undefined ? 'nota' : 'VALUES(nota)';
    await db.query(
      `INSERT INTO asistencias (obrero_id, fecha, jornales, nota) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         jornales = IF(pago_id IS NULL, VALUES(jornales), jornales),
         nota = IF(pago_id IS NULL, ${notaSql}, nota)`,
      [obrero_id, dia, j, nota ?? '']
    );
  }
  const [[actual]] = await db.query(
    'SELECT obrero_id, fecha, jornales, nota, pago_id FROM asistencias WHERE obrero_id = ? AND fecha = ?',
    [obrero_id, dia]
  );
  if (actual?.pago_id) return { bloqueado: true, registro: fila(actual) };
  return { registro: actual ? fila(actual) : null };
}

const BLOQUEADO = 'Ese día ya está pagado. Para cambiarlo, anulá el pago.';

router.put('/', async (req, res) => {
  const r = await marcar(pool, marcaSchema.parse(req.body));
  if (r.bloqueado) return res.status(409).json({ error: BLOQUEADO, registro: r.registro });
  res.json(r);
});

// Varios a la vez ("Todos ✓" y deshacer). Los días pagados se informan y no se tocan.
router.post('/lote', async (req, res) => {
  const { fecha: dia, items } = loteSchema.parse(req.body);
  const resultado = await tx(async (c) => {
    const registros = [];
    const bloqueados = [];
    for (const it of items) {
      const r = await marcar(c, { ...it, fecha: dia });
      if (r.bloqueado) bloqueados.push(it.obrero_id);
      registros.push({ obrero_id: it.obrero_id, registro: r.registro });
    }
    return { registros, bloqueados };
  });
  res.json(resultado);
});

module.exports = router;
