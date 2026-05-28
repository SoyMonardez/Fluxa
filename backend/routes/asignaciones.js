const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const z = require('zod');

const asignacionSchema = z.object({
  trabajador_id: z.number().positive(),
  proyecto_id: z.number().positive(),
  pago_jornal: z.number().positive(),
  fecha_desde: z.string()
});

// Get all active assignments for a project
router.get('/', async (req, res) => {
  const { proyecto_id } = req.query;
  if (!proyecto_id) return res.status(400).json({ error: 'Falta proyecto_id.' });
  try {
    const [rows] = await pool.execute(
      `SELECT a.*, t.nombre, t.rol
       FROM asignaciones a
       JOIN trabajadores t ON a.trabajador_id = t.id
       WHERE a.proyecto_id = ? AND a.activo = 1
       ORDER BY t.nombre ASC`,
      [proyecto_id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error obteniendo asignaciones.' });
  }
});

// Assign worker to project (or reactivate if exists)
router.post('/', async (req, res) => {
  try {
    const data = asignacionSchema.parse(req.body);
    // Deactivate any previous active assignment for this worker+project
    await pool.execute(
      'UPDATE asignaciones SET activo = 0 WHERE trabajador_id = ? AND proyecto_id = ?',
      [data.trabajador_id, data.proyecto_id]
    );
    const [result] = await pool.execute(
      'INSERT INTO asignaciones (trabajador_id, proyecto_id, pago_jornal, fecha_desde) VALUES (?, ?, ?, ?)',
      [data.trabajador_id, data.proyecto_id, data.pago_jornal, data.fecha_desde]
    );
    res.json({ id: result.insertId, ...data });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Datos inválidos.' });
    res.status(500).json({ error: 'Error creando asignación.' });
  }
});

// Update daily rate of an assignment
router.put('/:id', async (req, res) => {
  try {
    const { pago_jornal } = z.object({ pago_jornal: z.number().positive() }).parse(req.body);
    await pool.execute('UPDATE asignaciones SET pago_jornal = ? WHERE id = ?', [pago_jornal, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Datos inválidos.' });
    res.status(500).json({ error: 'Error actualizando asignación.' });
  }
});

// Remove worker from project
router.delete('/:id', async (req, res) => {
  try {
    await pool.execute('UPDATE asignaciones SET activo = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Error eliminando asignación.' });
  }
});

module.exports = router;
