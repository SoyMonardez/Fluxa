// Tablas locales: un Map por tabla (clave → fila), con el mismo formato que manda el servidor.
// Se tratan como inmutables: cada cambio crea un Map nuevo para la tabla tocada.

export const CLAVES = {
  cuadrillas: (f) => f.id,
  obreros: (f) => f.id,
  asistencias: (f) => `${f.obrero_id}|${f.fecha}`,
  adelantos: (f) => f.id,
  pagos: (f) => f.id,
  pago_items: (f) => f.id,
  herramientas: (f) => f.id,
  stock: (f) => `${f.herramienta_id}|${f.cuadrilla_id}`,
  movimientos: (f) => f.id,
};

export const NOMBRES = Object.keys(CLAVES);
const MAX_MOVIMIENTOS = 800;

export const vacias = () => Object.fromEntries(NOMBRES.map((n) => [n, new Map()]));

function limpiar(fila) {
  if (!('rev' in fila)) return fila;
  const { rev: _rev, ...resto } = fila;
  return resto;
}

/** Foto completa del servidor → tablas nuevas. */
export function desdeCambios(cambios) {
  const t = vacias();
  for (const n of NOMBRES) for (const f of cambios[n] || []) t[n].set(CLAVES[n](f), limpiar(f));
  return t;
}

/** Aplica los cambios del servidor sobre la base (sólo copia las tablas que cambian). */
export function fusionar(base, cambios) {
  const t = { ...base };
  for (const n of NOMBRES) {
    const filas = cambios[n];
    if (!filas?.length) continue;
    const m = new Map(base[n]);
    for (const f of filas) m.set(CLAVES[n](f), limpiar(f));
    t[n] = n === 'movimientos' && m.size > MAX_MOVIMIENTOS ? recortarMovimientos(m) : m;
  }
  return t;
}

function recortarMovimientos(m) {
  const orden = [...m.values()].sort((a, b) => (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : (b.creado || 0) - (a.creado || 0)));
  return new Map(orden.slice(0, MAX_MOVIMIENTOS * 0.75).map((f) => [f.id, f]));
}

/** Para editar varias tablas dentro de una operación copiando cada una una sola vez. */
export function editor(t) {
  const nuevo = { ...t };
  const copiadas = new Set();
  return {
    get: (n, k) => nuevo[n].get(k),
    filas: (n) => nuevo[n].values(),
    set(n, fila) {
      if (!copiadas.has(n)) {
        nuevo[n] = new Map(nuevo[n]);
        copiadas.add(n);
      }
      nuevo[n].set(CLAVES[n](fila), fila);
    },
    listo: () => nuevo,
  };
}
