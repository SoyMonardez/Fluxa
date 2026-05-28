const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const z = require('zod');

const finanzaSchema = z.object({
  proyecto_id: z.number().positive(),
  tipo: z.enum(['Ingreso', 'Egreso']),
  monto: z.number().positive(),
  categoria: z.string().min(1),
  descripcion: z.string().optional(),
  fecha: z.string()
});

router.post('/', async (req, res) => {
  try {
    const data = finanzaSchema.parse(req.body);
    const [result] = await pool.execute(
      'INSERT INTO finanzas (proyecto_id, tipo, monto, categoria, descripcion, fecha) VALUES (?, ?, ?, ?, ?, ?)',
      [data.proyecto_id, data.tipo, data.monto, data.categoria, data.descripcion || '', data.fecha]
    );
    res.json({ id: result.insertId, ...data });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Datos de entrada inválidos.' });
    res.status(500).json({ error: 'Error guardando finanza.' });
  }
});

// History endpoint
router.get('/historial', async (req, res) => {
  const { proyecto_id } = req.query;
  const where = proyecto_id ? ' WHERE proyecto_id = ?' : '';
  const params = proyecto_id ? [proyecto_id] : [];

  try {
    const [rows] = await pool.execute(`SELECT * FROM finanzas${where} ORDER BY fecha DESC, id DESC LIMIT 100`, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// Resumen del año o general agrupado por mes (para los charts)
router.get('/grafico', async (req, res) => {
  const { proyecto_id } = req.query;
  const where = proyecto_id ? ' AND proyecto_id = ?' : '';
  const params = proyecto_id ? [proyecto_id] : [];

  try {
    // Fetch all grouped by month and type
    const [rows] = await pool.execute(
      `SELECT DATE_FORMAT(fecha, '%Y-%m') as mes, tipo, SUM(monto) as total
       FROM finanzas
       WHERE 1=1 ${where}
       GROUP BY mes, tipo
       ORDER BY mes ASC`,
      params
    );

    // Fetch workers payroll grouped by month similarly (rough estimate based on their attendances)
    // Actually, properly it falls under egresos as 'Sueldos'. We can join 'asistencias' table.
    const [sueldosRows] = await pool.execute(
      `SELECT DATE_FORMAT(a.fecha, '%Y-%m') as mes, SUM((a.cantidad_jornales * t.pago_jornal_base) + a.extra_pago) as total
       FROM asistencias a
       JOIN trabajadores t ON a.trabajador_id = t.id
       WHERE 1=1 ${proyecto_id ? ' AND t.proyecto_id = ?' : ''}
       GROUP BY mes
       ORDER BY mes ASC`,
       params
    );

    res.json({ movimientos: rows, sueldos: sueldosRows });
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al obtener grafico data' });
  }
});

module.exports = router;
