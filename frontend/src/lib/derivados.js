// Cálculos a partir del estado (sin efectos).
import { ordenRol } from './formato';

const r2 = (n) => Math.round(n * 100) / 100;

/** Lo que lleva ganado sin pagar, lo que debe y lo que le queda. */
export function cuentaRapida(o) {
  const lleva = r2((o.pend_jornales || 0) * (o.jornal || 0));
  const deuda = o.deuda || 0;
  return { lleva, deuda, queda: r2(lleva - deuda) };
}

/** Orden dentro de una cuadrilla: encargado, después por rol y nombre. */
export function ordenar(obreros, encargadoId = null) {
  return [...obreros].sort(
    (a, b) =>
      (b.id === encargadoId) - (a.id === encargadoId) ||
      ordenRol(a.rol) - ordenRol(b.rol) ||
      a.nombre.localeCompare(b.nombre, 'es')
  );
}

/** [{ cuadrilla | null, obreros }] sólo con activos; "sin cuadrilla" al final. */
export function agruparPorCuadrilla(obreros, cuadrillas) {
  const activos = obreros.filter((o) => o.activo);
  const grupos = cuadrillas.map((c) => ({
    cuadrilla: c,
    obreros: ordenar(activos.filter((o) => o.cuadrilla_id === c.id), c.encargado_id),
  }));
  const ids = new Set(cuadrillas.map((c) => c.id));
  const sueltos = ordenar(activos.filter((o) => !ids.has(o.cuadrilla_id)));
  return [...grupos.filter((g) => g.obreros.length), ...(sueltos.length ? [{ cuadrilla: null, obreros: sueltos }] : [])];
}

/** Map(herramienta_id → [{ cuadrilla_id, cantidad }]) */
export function stockPorHerramienta(stock) {
  const m = new Map();
  for (const s of stock) {
    if (!m.has(s.herramienta_id)) m.set(s.herramienta_id, []);
    m.get(s.herramienta_id).push(s);
  }
  return m;
}

/** Map(cuadrilla_id → [{ herramienta_id, cantidad }]) */
export function stockPorCuadrilla(stock) {
  const m = new Map();
  for (const s of stock) {
    if (!m.has(s.cuadrilla_id)) m.set(s.cuadrilla_id, []);
    m.get(s.cuadrilla_id).push(s);
  }
  return m;
}

export const enObras = (lugares = []) => lugares.reduce((s, x) => s + x.cantidad, 0);
export const enPanol = (h, lugares = []) => h.cantidad - enObras(lugares);

export const buscar = (texto, ...campos) => {
  const q = normalizar(texto);
  if (!q) return true;
  return campos.some((c) => normalizar(c).includes(q));
};

export function normalizar(s = '') {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
