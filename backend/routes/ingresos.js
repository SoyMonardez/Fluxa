const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const z = require('zod');

const ingresoSchema = z.object({
  proyecto_id: z.number().positive(),
  tipo: z.enum(['Adelanto', 'Pago Parcial', 'Pago Final', 'Otro']),
  monto: z.number().positive(),
  descripcion: z.string().optional(),
  fecha: z.string()
});

router.get('/', async (req, res) => {
  const { proyecto_id } = req.query;
  if (!proyecto_id) return res.status(400).json({ error: 'Falta proyecto_id.' });
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM ingresos_obra WHERE proyecto_id = ? ORDER BY fecha DESC',
      [proyecto_id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error obteniendo ingresos.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = ingresoSchema.parse(req.body);
    const [result] = await pool.execute(
      'INSERT INTO ingresos_obra (proyecto_id, tipo, monto, descripcion, fecha) VALUES (?, ?, ?, ?, ?)',
      [data.proyecto_id, data.tipo, data.monto, data.descripcion || '', data.fecha]
    );
    const [rows] = await pool.execute('SELECT * FROM ingresos_obra WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Datos inválidos.' });
    res.status(500).json({ error: 'Error guardando ingreso.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const data = ingresoSchema.parse(req.body);
    await pool.execute(
      'UPDATE ingresos_obra SET proyecto_id=?, tipo=?, monto=?, descripcion=?, fecha=? WHERE id=?',
      [data.proyecto_id, data.tipo, data.monto, data.descripcion || '', data.fecha, req.params.id]
    );
    const [rows] = await pool.execute('SELECT * FROM ingresos_obra WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Datos inválidos.' });
    res.status(500).json({ error: 'Error actualizando ingreso.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM ingresos_obra WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Error eliminando ingreso.' });
  }
});

module.exports = router;
