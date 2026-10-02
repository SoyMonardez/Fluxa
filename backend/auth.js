const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const z = require('zod');
const { pool } = require('./db');
const { fail } = require('./lib/http');

const router = express.Router();
const SESION = '30d'; // en el celular no queremos pedir la clave todos los días

function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Ingresá para continuar.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'La sesión venció. Volvé a ingresar.' });
  }
}

// Freno simple contra adivinar la clave: 8 intentos fallidos cada 15 minutos por IP.
const fallos = new Map();
const VENTANA = 15 * 60 * 1000;
const MAX_FALLOS = 8;

function bloqueado(ip) {
  const f = fallos.get(ip);
  if (!f || f.hasta < Date.now()) return false;
  return f.n >= MAX_FALLOS;
}
function anotarFallo(ip) {
  const f = fallos.get(ip);
  if (!f || f.hasta < Date.now()) fallos.set(ip, { n: 1, hasta: Date.now() + VENTANA });
  else f.n += 1;
}

const loginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
});

router.post('/login', async (req, res) => {
  if (bloqueado(req.ip)) fail(429, 'Demasiados intentos. Probá de nuevo en unos minutos.');
  const { username, password } = loginSchema.parse(req.body);
  const [[user]] = await pool.query('SELECT id, username, password_hash FROM usuarios WHERE username = ?', [username]);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    anotarFallo(req.ip);
    fail(401, 'Usuario o contraseña incorrectos.');
  }
  fallos.delete(req.ip);
  const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: SESION });
  res.json({ token, username: user.username });
});

const claveSchema = z.object({
  actual: z.string().min(1).max(200),
  nueva: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres').max(200),
});

router.post('/clave', requireAuth, async (req, res) => {
  const { actual, nueva } = claveSchema.parse(req.body);
  const [[user]] = await pool.query('SELECT password_hash FROM usuarios WHERE id = ?', [req.user.id]);
  if (!user || !(await bcrypt.compare(actual, user.password_hash))) fail(400, 'La contraseña actual no es correcta.');
  await pool.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [await bcrypt.hash(nueva, 10), req.user.id]);
  res.json({ ok: true });
});

module.exports = { router, requireAuth };
