const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const z = require('zod');

const proveedorSchema = z.object({
  categoria: z.string().min(1),
  proveedor: z.string().optional(),
  descripcion: z.string().optional(),
  monto: z.number().positive(),
  fecha: z.string()
});

router.get('/', async (req, res) => {
  const { mes } = req.query; // optional YYYY-MM filter
  try {
    let query = 'SELECT * FROM gastos_proveedor';
    const params = [];
    if (mes) {
      query += ' WHERE DATE_FORMAT(fecha, \'%Y-%m\') = ?';
      params.push(mes);
    }
    query += ' ORDER BY fecha DESC';
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error obteniendo gastos de proveedores.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = proveedorSchema.parse(req.body);
    const [result] = await pool.execute(
      'INSERT INTO gastos_proveedor (categoria, proveedor, descripcion, monto, fecha) VALUES (?, ?, ?, ?, ?)',
      [data.categoria, data.proveedor || '', data.descripcion || '', data.monto, data.fecha]
    );
    const [rows] = await pool.execute('SELECT * FROM gastos_proveedor WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Datos inválidos.' });
    res.status(500).json({ error: 'Error guardando gasto.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const data = proveedorSchema.parse(req.body);
    await pool.execute(
      'UPDATE gastos_proveedor SET categoria=?, proveedor=?, descripcion=?, monto=?, fecha=? WHERE id=?',
      [data.categoria, data.proveedor || '', data.descripcion || '', data.monto, data.fecha, req.params.id]
    );
    const [rows] = await pool.execute('SELECT * FROM gastos_proveedor WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Datos inválidos.' });
    res.status(500).json({ error: 'Error actualizando gasto.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM gastos_proveedor WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Error eliminando gasto.' });
  }
});

module.exports = router;
