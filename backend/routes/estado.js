// Todo lo "base" en un solo pedido: la app lo guarda y abre al instante.
const router = require('express').Router();
const { pool } = require('../db');
const { deudas, pendientes, conCuenta, COLS_OBRERO } = require('../lib/cuentas');
const { hoyLocal } = require('../lib/fechas');

router.get('/', async (req, res) => {
  const [[obreros], [cuadrillas], [herramientas], [stock], deuda, pend] = await Promise.all([
    pool.query(`SELECT ${COLS_OBRERO} FROM obreros ORDER BY nombre`),
    pool.query('SELECT id, nombre, obra, color, encargado_id FROM cuadrillas WHERE activa = 1 ORDER BY nombre'),
    pool.query('SELECT id, nombre, tipo, cantidad, valor, nota FROM herramientas WHERE activo = 1 ORDER BY nombre'),
    pool.query('SELECT herramienta_id, cuadrilla_id, cantidad FROM herramienta_stock WHERE cantidad > 0'),
    deudas(pool),
    pendientes(pool),
  ]);
  res.json({
    hoy: hoyLocal(),
    obreros: obreros.map((o) => conCuenta(o, deuda, pend)),
    cuadrillas,
    herramientas,
    stock,
  });
});

module.exports = router;
