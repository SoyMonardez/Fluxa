const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const z = require('zod');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Ensure upload dir exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|webp/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    cb(null, allowed.test(ext));
  }
});

const CATEGORIAS = ['IVA', 'Ferretería / Áridos', 'Certificados de Obra', 'Pagos a Obreros', 'Otros'];

router.get('/', async (req, res) => {
  const { categoria, proyecto_id } = req.query;
  try {
    let query = 'SELECT * FROM comprobantes WHERE 1=1';
    const params = [];
    if (categoria) { query += ' AND categoria = ?'; params.push(categoria); }
    if (proyecto_id) { query += ' AND proyecto_id = ?'; params.push(proyecto_id); }
    query += ' ORDER BY fecha DESC, id DESC';
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error obteniendo comprobantes.' });
  }
});

router.post('/upload', upload.single('archivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo.' });
  try {
    const { categoria, descripcion, fecha, proyecto_id } = req.body;
    if (!CATEGORIAS.includes(categoria)) return res.status(400).json({ error: 'Categoría inválida.' });

    const cat = categoria.replace(/[^a-zA-Z0-9]/g, '_');
    const dir = path.join(UPLOADS_DIR, cat);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const filename = unique + path.extname(req.file.originalname);
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, req.file.buffer);

    const nombre_archivo = `${cat}/${filename}`;

    const [result] = await pool.execute(
      `INSERT INTO comprobantes (categoria, nombre_original, nombre_archivo, mime_type, tamanio, descripcion, fecha, proyecto_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        categoria,
        req.file.originalname,
        nombre_archivo,
        req.file.mimetype,
        req.file.size,
        descripcion || '',
        fecha || new Date().toISOString().split('T')[0],
        proyecto_id || null
      ]
    );
    const [rows] = await pool.execute('SELECT * FROM comprobantes WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error guardando comprobante.' });
  }
});

// Serve file
router.get('/archivo/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM comprobantes WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado.' });
    const filePath = path.join(UPLOADS_DIR, rows[0].nombre_archivo);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado.' });
    res.setHeader('Content-Disposition', `inline; filename="${rows[0].nombre_original}"`);
    res.sendFile(filePath);
  } catch {
    res.status(500).json({ error: 'Error al obtener archivo.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM comprobantes WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado.' });
    const filePath = path.join(UPLOADS_DIR, rows[0].nombre_archivo);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await pool.execute('DELETE FROM comprobantes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Error eliminando comprobante.' });
  }
});

module.exports = router;
