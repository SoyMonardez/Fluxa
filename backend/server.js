const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const proyectosRoutes = require('./routes/proyectos');
const trabajadoresRoutes = require('./routes/trabajadores');
const asignacionesRoutes = require('./routes/asignaciones');
const asistenciasRoutes = require('./routes/asistencias');
const ingresosRoutes = require('./routes/ingresos');
const proveedoresRoutes = require('./routes/proveedores');
const comprobantesRoutes = require('./routes/comprobantes');
const dashboardRoutes = require('./routes/dashboard');
const verifyToken = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', verifyToken, express.static(path.join(__dirname, 'uploads')));

// Public
app.use('/api/auth', authRoutes);

// Protected
app.use('/api/proyectos', verifyToken, proyectosRoutes);
app.use('/api/trabajadores', verifyToken, trabajadoresRoutes);
app.use('/api/asignaciones', verifyToken, asignacionesRoutes);
app.use('/api/asistencias', verifyToken, asistenciasRoutes);
app.use('/api/ingresos', verifyToken, ingresosRoutes);
app.use('/api/proveedores', verifyToken, proveedoresRoutes);
app.use('/api/comprobantes', verifyToken, comprobantesRoutes);
app.use('/api/dashboard', verifyToken, dashboardRoutes);

app.listen(PORT, () => {
  console.log(`ETEM Backend corriendo en http://localhost:${PORT}`);
});
