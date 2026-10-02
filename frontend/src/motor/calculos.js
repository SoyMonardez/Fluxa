// Reglas de cuentas (docs/DISENO.md §5). Las mismas que aplica el servidor.
import { semanaDePago } from '../lib/fechas.js';

export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Liquida a un obrero: bruto = jornales × jornal; el descuento no supera la deuda
 * ni lo que cobra (bruto + plus). Sin descuento indicado se descuenta todo lo posible.
 */
export function liquidar({ jornales, jornal, deuda = 0, plus = 0, descuento = null }) {
  const bruto = r2(jornales * jornal);
  const plusOk = r2(Math.max(0, Number(plus) || 0));
  const tope = r2(Math.max(0, Math.min(Number(deuda) || 0, bruto + plusOk)));
  const desc = descuento == null ? tope : r2(Math.min(Math.max(0, Number(descuento) || 0), tope));
  return { bruto, plus: plusOk, tope, descuento: desc, neto: r2(bruto + plusOk - desc) };
}

const porAntiguedad = (a, b) => (a.creado - b.creado) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Reparte lo descontado del adelanto más viejo al más nuevo. Map(id → { descontado, pendiente }). */
export function estadoAdelantos(adelantos, descontado) {
  let resto = r2(Math.max(0, descontado));
  const estado = new Map();
  for (const a of [...adelantos].sort(porAntiguedad)) {
    const usado = r2(Math.min(resto, a.monto));
    resto = r2(resto - usado);
    estado.set(a.id, { descontado: usado, pendiente: r2(a.monto - usado) });
  }
  return estado;
}

export function pagosValidos(t) {
  const ids = new Set();
  for (const p of t.pagos.values()) if (!p.anulado) ids.add(p.id);
  return ids;
}

/**
 * Cuenta de cada obrero: Map(id → { adelantos, descontado, deuda, pend_dias, pend_jornales, pend_desde }).
 * deuda = adelantos no anulados − descuentos de pagos no anulados.
 * pendiente = días trabajados sin pago.
 */
export function cuentas(t) {
  const c = new Map();
  const de = (id) => {
    let x = c.get(id);
    if (!x) {
      x = { adelantos: 0, descontado: 0, deuda: 0, pend_dias: 0, pend_jornales: 0, pend_desde: null };
      c.set(id, x);
    }
    return x;
  };
  for (const a of t.adelantos.values()) if (!a.anulado) de(a.obrero_id).adelantos += a.monto;
  const validos = pagosValidos(t);
  for (const i of t.pago_items.values()) if (validos.has(i.pago_id)) de(i.obrero_id).descontado += i.descuento;
  for (const a of t.asistencias.values()) {
    if (!(a.jornales > 0) || a.pago_id) continue;
    const x = de(a.obrero_id);
    x.pend_dias += 1;
    x.pend_jornales += a.jornales;
    if (!x.pend_desde || a.fecha < x.pend_desde) x.pend_desde = a.fecha;
  }
  for (const x of c.values()) {
    x.adelantos = r2(x.adelantos);
    x.descontado = r2(x.descontado);
    x.deuda = r2(Math.max(0, x.adelantos - x.descontado));
    x.pend_jornales = Math.round(x.pend_jornales * 10) / 10;
  }
  return c;
}

export const deudaDe = (t, obreroId) => cuentas(t).get(obreroId)?.deuda ?? 0;

/** Próximo pago con corte en "hasta": días sin pagar hasta esa fecha, por obrero. */
export function previewPago(t, hasta) {
  const c = cuentas(t);
  const dias = new Map();
  for (const a of t.asistencias.values()) {
    if (!(a.jornales > 0) || a.pago_id || a.fecha > hasta) continue;
    if (!dias.has(a.obrero_id)) dias.set(a.obrero_id, []);
    dias.get(a.obrero_id).push({ fecha: a.fecha, jornales: a.jornales });
  }
  const items = [];
  const sinDias = [];
  const obreros = [...t.obreros.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  for (const o of obreros) {
    const deuda = c.get(o.id)?.deuda ?? 0;
    const suyos = dias.get(o.id);
    if (!suyos) {
      if (o.activo && deuda > 0) sinDias.push({ obrero_id: o.id, nombre: o.nombre, rol: o.rol, deuda });
      continue;
    }
    suyos.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    const jornales = Math.round(suyos.reduce((s, x) => s + x.jornales, 0) * 10) / 10;
    items.push({
      obrero_id: o.id,
      nombre: o.nombre,
      rol: o.rol,
      telefono: o.telefono,
      cuadrilla_id: o.cuadrilla_id,
      activo: o.activo,
      jornal: o.jornal,
      dias: suyos.length,
      jornales,
      desde: suyos[0].fecha,
      asistencias: suyos,
      deuda,
      ...liquidar({ jornales, jornal: o.jornal, deuda }),
    });
  }
  return { hasta, semana: semanaDePago(hasta), items, sin_dias: sinDias };
}
