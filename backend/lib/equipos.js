// Foto de cuadrillas + a qué cuadrilla pertenece cada obrero.
// Se devuelve después de cualquier cambio de integrantes o encargado para que
// la app quede sincronizada sin tener que recargar todo.
async function equipos(db) {
  const [[cuadrillas], [asignaciones]] = await Promise.all([
    db.query('SELECT id, nombre, obra, color, encargado_id FROM cuadrillas WHERE activa = 1 ORDER BY nombre'),
    db.query('SELECT id, cuadrilla_id FROM obreros'),
  ]);
  return { cuadrillas, asignaciones };
}

async function stockDe(db, herramientaIds = null) {
  if (herramientaIds && herramientaIds.length === 0) return [];
  const [rows] = await db.query(
    `SELECT herramienta_id, cuadrilla_id, cantidad FROM herramienta_stock
      WHERE cantidad > 0${herramientaIds ? ' AND herramienta_id IN (?)' : ''}`,
    herramientaIds ? [herramientaIds] : []
  );
  return rows;
}

module.exports = { equipos, stockDe };
