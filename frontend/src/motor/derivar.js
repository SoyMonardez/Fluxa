// Lo que muestra la pantalla, armado a partir de las tablas locales: listas
// ordenadas, cuenta de cada obrero y consultas de las hojas (ficha, pagos,
// movimientos). Todo sale del teléfono, así funciona igual sin señal.
import { cuentas, estadoAdelantos, pagosValidos, r2 } from './calculos.js';

const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
const masNuevoPrimero = (a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (b.creado ?? 0) - (a.creado ?? 0));

function igual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

/** Reusa los objetos que no cambiaron (y la lista entera si nada cambió): React redibuja sólo lo necesario. */
function reusar(nueva, vieja, clave = (x) => x.id) {
  if (!vieja) return nueva;
  const previos = new Map(vieja.map((x) => [clave(x), x]));
  let cambio = nueva.length !== vieja.length;
  const r = nueva.map((x, i) => {
    const p = previos.get(clave(x));
    const y = p && igual(p, x) ? p : x;
    if (y !== vieja[i]) cambio = true;
    return y;
  });
  return cambio ? r : vieja;
}

function listaObreros(t) {
  const c = cuentas(t);
  return [...t.obreros.values()]
    .map((o) => {
      const x = c.get(o.id);
      return { ...o, deuda: x?.deuda ?? 0, pend_dias: x?.pend_dias ?? 0, pend_jornales: x?.pend_jornales ?? 0, pend_desde: x?.pend_desde ?? null };
    })
    .sort(porNombre);
}

/** { 'YYYY-MM-DD': { [obreroId]: { jornales, nota, pagado } } } */
function porDia(asistencias, previo) {
  const dias = {};
  for (const a of asistencias.values()) {
    (dias[a.fecha] ??= {})[a.obrero_id] = { jornales: a.jornales, nota: a.nota, pagado: Boolean(a.pago_id) };
  }
  if (!previo) return dias;
  for (const [fecha, dia] of Object.entries(dias)) {
    const antes = previo[fecha];
    if (!antes) continue;
    let mismo = Object.keys(antes).length === Object.keys(dia).length;
    for (const id of Object.keys(dia)) {
      if (igual(antes[id], dia[id])) dia[id] = antes[id];
      else mismo = false;
    }
    if (mismo) dias[fecha] = antes;
  }
  return dias;
}

/** Devuelve una función tablas → vista que recalcula sólo lo que depende de tablas que cambiaron. */
export function crearVista() {
  const memo = {};
  const calc = (nombre, deps, fn) => {
    const m = memo[nombre];
    if (m && m.deps.every((d, i) => d === deps[i])) return m.valor;
    const valor = fn(m?.valor);
    memo[nombre] = { deps, valor };
    return valor;
  };
  return (t) => ({
    tablas: t,
    obreros: calc('obreros', [t.obreros, t.adelantos, t.pagos, t.pago_items, t.asistencias], (v) => reusar(listaObreros(t), v)),
    cuadrillas: calc('cuadrillas', [t.cuadrillas], (v) => reusar([...t.cuadrillas.values()].filter((c) => c.activa).sort(porNombre), v)),
    herramientas: calc('herramientas', [t.herramientas], (v) => reusar([...t.herramientas.values()].filter((h) => h.activo).sort(porNombre), v)),
    stock: calc('stock', [t.stock], (v) =>
      reusar(
        [...t.stock.values()].filter((s) => s.cantidad > 0),
        v,
        (s) => `${s.herramienta_id}|${s.cuadrilla_id}`
      )
    ),
    asistencia: calc('asistencia', [t.asistencias], (v) => porDia(t.asistencias, v)),
  });
}

/* ── Consultas de las hojas ─────────────────────────────────────────────── */

/** Ficha del obrero: días trabajados, adelantos (con lo ya descontado) y pagos cobrados. */
export function cuentaObrero(t, obreroId) {
  const asistencias = [];
  for (const a of t.asistencias.values()) {
    if (a.obrero_id === obreroId && a.jornales > 0) asistencias.push({ fecha: a.fecha, jornales: a.jornales, nota: a.nota, pagado: Boolean(a.pago_id) });
  }
  asistencias.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  const validos = pagosValidos(t);
  const items = [...t.pago_items.values()].filter((i) => i.obrero_id === obreroId && validos.has(i.pago_id));
  const suyos = [...t.adelantos.values()].filter((a) => a.obrero_id === obreroId && !a.anulado);
  const estado = estadoAdelantos(suyos, r2(items.reduce((s, i) => s + i.descuento, 0)));
  const adelantos = suyos.map((a) => ({ ...a, ...estado.get(a.id) })).sort(masNuevoPrimero);

  const pagos = items
    .map((i) => {
      const p = t.pagos.get(i.pago_id);
      return { pago_id: i.pago_id, fecha: p.fecha, hasta: p.hasta, creado: p.creado, jornales: i.jornales, jornal: i.jornal, plus: i.plus, descuento: i.descuento, neto: i.neto };
    })
    .sort(masNuevoPrimero);

  return { asistencias: asistencias.slice(0, 150), adelantos, pagos };
}

/** Pagos hechos (sin los anulados), el más nuevo primero. */
export function listaPagos(t) {
  const resumen = new Map();
  for (const i of t.pago_items.values()) {
    const r = resumen.get(i.pago_id) ?? { obreros: 0, jornales: 0 };
    r.obreros += 1;
    r.jornales += i.jornales;
    resumen.set(i.pago_id, r);
  }
  return [...t.pagos.values()]
    .filter((p) => !p.anulado)
    .map((p) => {
      const r = resumen.get(p.id);
      return { ...p, obreros: r?.obreros ?? 0, jornales: Math.round((r?.jornales ?? 0) * 10) / 10 };
    })
    .sort(masNuevoPrimero);
}

/** Un pago con el detalle de cada obrero (para el recibo). */
export function detallePago(t, pagoId) {
  const p = t.pagos.get(pagoId);
  if (!p) return null;
  const items = [...t.pago_items.values()]
    .filter((i) => i.pago_id === pagoId)
    .map((i) => {
      const o = t.obreros.get(i.obrero_id);
      return {
        ...i,
        nombre: o?.nombre ?? '—',
        rol: o?.rol ?? '',
        telefono: o?.telefono ?? '',
        // Los días muy viejos pueden no estar en el teléfono: queda la fecha sola.
        asistencias: i.fechas.map((fecha) => ({ fecha, jornales: t.asistencias.get(`${i.obrero_id}|${fecha}`)?.jornales ?? null })),
      };
    })
    .sort(porNombre);
  return { ...p, items };
}

/** Historial de herramientas, con los nombres ya puestos. */
export function movimientosDe(t, { herramientaId = null, cuadrillaId = null, limite = 40 } = {}) {
  const nombre = (tabla, id) => (id ? (tabla.get(id)?.nombre ?? '—') : null);
  return [...t.movimientos.values()]
    .filter((m) => (!herramientaId || m.herramienta_id === herramientaId) && (!cuadrillaId || m.desde_id === cuadrillaId || m.hacia_id === cuadrillaId))
    .sort(masNuevoPrimero)
    .slice(0, limite)
    .map((m) => ({
      ...m,
      herramienta: nombre(t.herramientas, m.herramienta_id),
      desde_nombre: nombre(t.cuadrillas, m.desde_id),
      hacia_nombre: nombre(t.cuadrillas, m.hacia_id),
      responsable_nombre: nombre(t.obreros, m.responsable_id),
    }));
}
