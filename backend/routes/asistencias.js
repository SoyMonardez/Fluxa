const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const z = require('zod');

const asistenciaSchema = z.object({
  trabajador_id: z.number().positive(),
  proyecto_id: z.number().positive(),
  fecha: z.string(),
  cantidad_jornales: z.number().min(0).max(2),
  extra_pago: z.number()
});

// Weekly attendance matrix for a project
router.get('/semana', async (req, res) => {
  const { start, end, proyecto_id } = req.query;
  if (!start || !end || !proyecto_id) return res.status(400).json({ error: 'Faltan parámetros.' });
  try {
    // Workers assigned to this project with their rate
    const [trabajadores] = await pool.execute(
      `SELECT t.id, t.nombre, t.rol, a.pago_jornal, a.id as asignacion_id
       FROM trabajadores t
       JOIN asignaciones a ON t.id = a.trabajador_id
       WHERE a.proyecto_id = ? AND a.activo = 1
       ORDER BY t.nombre ASC`,
      [proyecto_id]
    );

    const [asistencias] = await pool.execute(
      `SELECT id, trabajador_id, proyecto_id,
         DATE_FORMAT(fecha, '%Y-%m-%d') as fecha,
         CAST(cantidad_jornales AS UNSIGNED) as cantidad_jornales,
         CAST(extra_pago AS SIGNED) as extra_pago
       FROM asistencias WHERE proyecto_id = ? AND fecha >= ? AND fecha <= ?`,
      [proyecto_id, start, end]
    );

    const matriz = trabajadores.map(t => ({
      ...t,
      asistencias: asistencias.filter(a => a.trabajador_id === t.id)
    }));

    res.json(matriz);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener matriz semanal.' });
  }
});

// Record or update attendance
router.post('/', async (req, res) => {
  try {
    const data = asistenciaSchema.parse(req.body);
    await pool.execute(
      `INSERT INTO asistencias (trabajador_id, proyecto_id, fecha, cantidad_jornales, extra_pago)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE cantidad_jornales=VALUES(cantidad_jornales), extra_pago=VALUES(extra_pago)`,
      [data.trabajador_id, data.proyecto_id, data.fecha, data.cantidad_jornales, data.extra_pago]
    );
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Datos inválidos.' });
    res.status(500).json({ error: 'Error al guardar asistencia.' });
  }
});

// Weekly payroll summary for a project
router.get('/liquidacion', async (req, res) => {
  const { start, end, proyecto_id } = req.query;
  if (!start || !end || !proyecto_id) return res.status(400).json({ error: 'Faltan parámetros.' });
  try {
    const [rows] = await pool.execute(
      `SELECT t.id, t.nombre, t.rol,
        a.pago_jornal,
        COALESCE(SUM(ast.cantidad_jornales), 0) as suma_jornales,
        COALESCE(SUM(ast.extra_pago), 0) as suma_extras,
        (COALESCE(SUM(ast.cantidad_jornales), 0) * a.pago_jornal) + COALESCE(SUM(ast.extra_pago), 0) as pago_final
       FROM trabajadores t
       JOIN asignaciones a ON t.id = a.trabajador_id AND a.proyecto_id = ? AND a.activo = 1
       LEFT JOIN asistencias ast ON t.id = ast.trabajador_id AND ast.proyecto_id = ? AND ast.fecha >= ? AND ast.fecha <= ?
       GROUP BY t.id, t.nombre, t.rol, a.pago_jornal
       ORDER BY t.nombre ASC`,
      [proyecto_id, proyecto_id, start, end]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular liquidación.' });
  }
});

module.exports = router;
