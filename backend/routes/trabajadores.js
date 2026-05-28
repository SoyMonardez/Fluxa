const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const z = require('zod');

const trabajadorSchema = z.object({
  nombre: z.string().min(1),
  rol: z.string().min(1)
});

// GET all workers (global, optionally filter by proyecto_id via asignaciones)
router.get('/', async (req, res) => {
  const { proyecto_id } = req.query;
  try {
    if (proyecto_id) {
      const [rows] = await pool.execute(
        `SELECT t.*, a.id as asignacion_id, a.pago_jornal, a.activo as asignado
         FROM trabajadores t
         JOIN asignaciones a ON t.id = a.trabajador_id
         WHERE a.proyecto_id = ? AND a.activo = 1
         ORDER BY t.nombre ASC`,
        [proyecto_id]
      );
      return res.json(rows);
    }
    const [rows] = await pool.execute('SELECT * FROM trabajadores WHERE activo = 1 ORDER BY nombre ASC');
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error obteniendo trabajadores.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = trabajadorSchema.parse(req.body);
    const [result] = await pool.execute(
      'INSERT INTO trabajadores (nombre, rol) VALUES (?, ?)',
      [data.nombre, data.rol]
    );
    const [rows] = await pool.execute('SELECT * FROM trabajadores WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Datos inválidos.' });
    res.status(500).json({ error: 'Error creando trabajador.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const data = trabajadorSchema.parse(req.body);
    await pool.execute(
      'UPDATE trabajadores SET nombre=?, rol=? WHERE id=?',
      [data.nombre, data.rol, req.params.id]
    );
    const [rows] = await pool.execute('SELECT * FROM trabajadores WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Datos inválidos.' });
    res.status(500).json({ error: 'Error actualizando trabajador.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.execute('UPDATE trabajadores SET activo = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Error eliminando trabajador.' });
  }
});

module.exports = router;
