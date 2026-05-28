const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// General summary stats (optional ?proyecto_id filter)
router.get('/resumen', async (req, res) => {
  try {
    const pid = req.query.proyecto_id ? Number(req.query.proyecto_id) : null;

    const [[{ total_ingresos }]] = pid
      ? await pool.execute('SELECT COALESCE(SUM(monto), 0) as total_ingresos FROM ingresos_obra WHERE proyecto_id = ?', [pid])
      : await pool.execute('SELECT COALESCE(SUM(monto), 0) as total_ingresos FROM ingresos_obra');

    const [[{ total_nomina }]] = pid
      ? await pool.execute(
          `SELECT COALESCE(SUM((ast.cantidad_jornales * asig.pago_jornal) + ast.extra_pago), 0) as total_nomina
           FROM asistencias ast
           JOIN asignaciones asig ON ast.trabajador_id = asig.trabajador_id AND ast.proyecto_id = asig.proyecto_id AND asig.activo = 1
           WHERE ast.proyecto_id = ?`, [pid])
      : await pool.execute(
          `SELECT COALESCE(SUM((ast.cantidad_jornales * asig.pago_jornal) + ast.extra_pago), 0) as total_nomina
           FROM asistencias ast
           JOIN asignaciones asig ON ast.trabajador_id = asig.trabajador_id AND ast.proyecto_id = asig.proyecto_id AND asig.activo = 1`);

    // Proveedores are global (not per obra)
    const [[{ total_proveedores }]] = await pool.execute(
      'SELECT COALESCE(SUM(monto), 0) as total_proveedores FROM gastos_proveedor'
    );
    const [[{ total_obras }]] = await pool.execute(
      'SELECT COUNT(*) as total_obras FROM proyectos'
    );
    const [[{ obras_activas }]] = await pool.execute(
      'SELECT COUNT(*) as obras_activas FROM proyectos WHERE estado = "Activo"'
    );

    const liquidez = Number(total_ingresos) - Number(total_nomina) - (pid ? 0 : Number(total_proveedores));

    res.json({
      total_ingresos: Number(total_ingresos),
      total_nomina: Number(total_nomina),
      total_proveedores: pid ? null : Number(total_proveedores),
      liquidez,
      total_obras: Number(total_obras),
      obras_activas: Number(obras_activas),
      filtrado_por_obra: pid
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener resumen.' });
  }
});

// Monthly chart data (last 12 months, optional ?proyecto_id filter)
router.get('/grafico', async (req, res) => {
  try {
    const pid = req.query.proyecto_id ? Number(req.query.proyecto_id) : null;

    const [ingresos] = pid
      ? await pool.execute(
          `SELECT DATE_FORMAT(fecha, '%Y-%m') as mes, SUM(monto) as total
           FROM ingresos_obra
           WHERE proyecto_id = ? AND fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
           GROUP BY mes ORDER BY mes ASC`, [pid])
      : await pool.execute(
          `SELECT DATE_FORMAT(fecha, '%Y-%m') as mes, SUM(monto) as total
           FROM ingresos_obra
           WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
           GROUP BY mes ORDER BY mes ASC`);

    const [nomina] = pid
      ? await pool.execute(
          `SELECT DATE_FORMAT(ast.fecha, '%Y-%m') as mes,
            SUM((ast.cantidad_jornales * asig.pago_jornal) + ast.extra_pago) as total
           FROM asistencias ast
           JOIN asignaciones asig ON ast.trabajador_id = asig.trabajador_id AND ast.proyecto_id = asig.proyecto_id AND asig.activo = 1
           WHERE ast.proyecto_id = ? AND ast.fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
           GROUP BY mes ORDER BY mes ASC`, [pid])
      : await pool.execute(
          `SELECT DATE_FORMAT(ast.fecha, '%Y-%m') as mes,
            SUM((ast.cantidad_jornales * asig.pago_jornal) + ast.extra_pago) as total
           FROM asistencias ast
           JOIN asignaciones asig ON ast.trabajador_id = asig.trabajador_id AND ast.proyecto_id = asig.proyecto_id AND asig.activo = 1
           WHERE ast.fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
           GROUP BY mes ORDER BY mes ASC`);

    const [proveedores] = pid ? [[] ] : await pool.execute(
      `SELECT DATE_FORMAT(fecha, '%Y-%m') as mes, SUM(monto) as total
       FROM gastos_proveedor
       WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY mes ORDER BY mes ASC`
    );

    // Merge into unified month list
    const meses = [...new Set([
      ...ingresos.map(r => r.mes),
      ...nomina.map(r => r.mes),
      ...proveedores.map(r => r.mes)
    ])].sort();

    const data = meses.map(mes => ({
      mes,
      ingresos: Number(ingresos.find(r => r.mes === mes)?.total || 0),
      nomina: Number(nomina.find(r => r.mes === mes)?.total || 0),
      proveedores: Number(proveedores.find(r => r.mes === mes)?.total || 0)
    }));

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener gráfico.' });
  }
});

// Per-project financial summary
router.get('/obras', async (req, res) => {
  try {
    const [proyectos] = await pool.execute('SELECT * FROM proyectos ORDER BY id DESC');

    const resumen = await Promise.all(proyectos.map(async (p) => {
      const [[{ ingresos }]] = await pool.execute(
        'SELECT COALESCE(SUM(monto), 0) as ingresos FROM ingresos_obra WHERE proyecto_id = ?',
        [p.id]
      );
      const [[{ nomina }]] = await pool.execute(
        `SELECT COALESCE(SUM((ast.cantidad_jornales * asig.pago_jornal) + ast.extra_pago), 0) as nomina
         FROM asistencias ast
         JOIN asignaciones asig ON ast.trabajador_id = asig.trabajador_id AND ast.proyecto_id = asig.proyecto_id AND asig.activo = 1
         WHERE ast.proyecto_id = ?`,
        [p.id]
      );
      return {
        ...p,
        ingresos: Number(ingresos),
        nomina: Number(nomina),
        margen: Number(ingresos) - Number(nomina)
      };
    }));

    res.json(resumen);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener resumen por obra.' });
  }
});

module.exports = router;
