const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const z = require('zod');

const proySchema = z.object({
  nombre: z.string().min(1),
  cliente: z.string().optional(),
  descripcion: z.string().optional(),
  fecha_inicio: z.string(),
  fecha_fin: z.string().optional().nullable(),
  estado: z.enum(['Activo', 'Pausado', 'Terminado']).optional()
});

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM proyectos ORDER BY id DESC');
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error obteniendo proyectos.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = proySchema.parse(req.body);
    const [result] = await pool.execute(
      'INSERT INTO proyectos (nombre, cliente, descripcion, fecha_inicio, fecha_fin) VALUES (?, ?, ?, ?, ?)',
      [data.nombre, data.cliente || '', data.descripcion || '', data.fecha_inicio, data.fecha_fin || null]
    );
    const [rows] = await pool.execute('SELECT * FROM proyectos WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Datos inválidos.' });
    res.status(500).json({ error: 'Error creando proyecto.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const data = proySchema.parse(req.body);
    await pool.execute(
      'UPDATE proyectos SET nombre=?, cliente=?, descripcion=?, fecha_inicio=?, fecha_fin=?, estado=? WHERE id=?',
      [data.nombre, data.cliente || '', data.descripcion || '', data.fecha_inicio, data.fecha_fin || null, data.estado || 'Activo', req.params.id]
    );
    const [rows] = await pool.execute('SELECT * FROM proyectos WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Datos inválidos.' });
    res.status(500).json({ error: 'Error actualizando proyecto.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM proyectos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Error eliminando proyecto.' });
  }
});

module.exports = router;
