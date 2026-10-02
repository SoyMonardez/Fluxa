require('dotenv').config({ quiet: true });
const express = require('express');
const z = require('zod');
const { HttpError } = require('./lib/http');
const auth = require('./auth');

z.config(z.locales.es()); // mensajes de validación en castellano

if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET en el entorno (.env). Sin eso no se pueden firmar las sesiones.');
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.disable('x-powered-by');
app.set('trust proxy', 1); // detrás de nginx
app.use(express.json({ limit: '256kb' }));

app.get('/api/salud', (req, res) => res.json({ ok: true }));
app.use('/api/auth', auth.router);

app.use('/api', auth.requireAuth);
app.use('/api/estado', require('./routes/estado'));
app.use('/api/obreros', require('./routes/obreros'));
app.use('/api/cuadrillas', require('./routes/cuadrillas'));
app.use('/api/asistencia', require('./routes/asistencia'));
app.use('/api/adelantos', require('./routes/adelantos'));
app.use('/api/pagos', require('./routes/pagos'));
app.use('/api/herramientas', require('./routes/herramientas'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta inexistente.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof z.ZodError) {
    const primero = err.issues[0];
    return res.status(400).json({ error: primero?.message || 'Datos inválidos.', detalle: err.issues });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'Hace referencia a algo que no existe.' });
  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`Fluxa / ETEM API en http://localhost:${PORT}`);
});
