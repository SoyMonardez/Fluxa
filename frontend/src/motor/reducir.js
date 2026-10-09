// Aplica una operación sobre las tablas locales (función pura).
// Mismas reglas que el servidor (backend/app/operaciones.py). Si la operación no es
// válida tira Rechazo con un mensaje para mostrar.
import { corta } from '../lib/fechas.js';
import { estadoAdelantos, pagosValidos, r2 } from './calculos.js';
import { editor } from './tablas.js';

export class Rechazo extends Error {}

const JORNADAS = [0, 0.5, 1, 1.5, 2];
const RECLAMOS = { robo: 'Robo', faltante: 'Faltante', rotura: 'Rotura por mal uso' };

function obrero(e, id) {
  const o = e.get('obreros', id);
  if (!o) throw new Rechazo('El obrero no existe.');
  return o;
}

function cuadrillaActiva(e, id) {
  if (id == null) return null;
  const c = e.get('cuadrillas', id);
  if (!c || !c.activa) throw new Rechazo('La cuadrilla no existe o ya se cerró.');
  return c;
}

function herramientaActiva(e, id) {
  const h = e.get('herramientas', id);
  if (!h || !h.activo) throw new Rechazo('La herramienta no existe.');
  let asignado = 0;
  for (const s of e.filas('stock')) if (s.herramienta_id === id) asignado += s.cantidad;
  return { ...h, asignado, panol: h.cantidad - asignado };
}

const enCuadrilla = (e, hid, cid) => e.get('stock', `${hid}|${cid}`)?.cantidad ?? 0;

function sumarStock(e, hid, cid, delta) {
  const s = e.get('stock', `${hid}|${cid}`);
  e.set('stock', { herramienta_id: hid, cuadrilla_id: cid, cantidad: (s?.cantidad ?? 0) + delta });
}

function movimiento(e, op, n, datos) {
  // Id provisorio: al sincronizar llega el definitivo del servidor.
  const id = `${op.id}:${n}`;
  e.set('movimientos', {
    id,
    desde_id: null,
    hacia_id: null,
    responsable_id: null,
    cargo: 0,
    nota: '',
    creado: op.ts,
    ...datos,
  });
  return id;
}

function sacarEncargado(e, obreroId, salvo = null) {
  for (const c of [...e.filas('cuadrillas')]) {
    if (c.encargado_id === obreroId && c.id !== salvo) e.set('cuadrillas', { ...c, encargado_id: null });
  }
}

function ponerEncargado(e, cuadrillaId, obreroId) {
  const c = e.get('cuadrillas', cuadrillaId);
  if (obreroId == null) {
    if (c.encargado_id) e.set('cuadrillas', { ...c, encargado_id: null });
    return;
  }
  const o = obrero(e, obreroId);
  if (!o.activo) throw new Rechazo(`${o.nombre} está dado de baja.`);
  sacarEncargado(e, obreroId, cuadrillaId);
  if (o.cuadrilla_id !== cuadrillaId) e.set('obreros', { ...o, cuadrilla_id: cuadrillaId });
  const actual = e.get('cuadrillas', cuadrillaId);
  if (actual.encargado_id !== obreroId) e.set('cuadrillas', { ...actual, encargado_id: obreroId });
}

function marcarDia(e, obreroId, fecha, jornales, nota, saltearPagados) {
  if (!JORNADAS.includes(jornales)) throw new Rechazo('Jornada inválida (0, ½, 1, 1½ o 2).');
  const fila = e.get('asistencias', `${obreroId}|${fecha}`);
  if (fila?.pago_id) {
    if (saltearPagados) return;
    throw new Rechazo(`El ${corta(fecha)} de ${obrero(e, obreroId).nombre} ya está pagado. Para cambiarlo, anulá el pago.`);
  }
  const nuevaNota = nota ?? fila?.nota ?? '';
  if (!fila) {
    if (!jornales) return;
    obrero(e, obreroId);
    e.set('asistencias', { obrero_id: obreroId, fecha, jornales, nota: nuevaNota, pago_id: null });
  } else if (fila.jornales !== jornales || fila.nota !== nuevaNota) {
    e.set('asistencias', { ...fila, jornales, nota: nuevaNota });
  }
}

function descontadoDe(e, obreroId) {
  const t = e.listo();
  const validos = pagosValidos(t);
  let total = 0;
  for (const i of t.pago_items.values()) if (i.obrero_id === obreroId && validos.has(i.pago_id)) total += i.descuento;
  return r2(total);
}

function deudaDe(e, obreroId) {
  let adelantos = 0;
  for (const a of e.filas('adelantos')) if (a.obrero_id === obreroId && !a.anulado) adelantos += a.monto;
  return r2(Math.max(0, adelantos - descontadoDe(e, obreroId)));
}

const OPERACIONES = {
  'obrero.guardar'(e, d) {
    cuadrillaActiva(e, d.cuadrilla_id ?? null);
    const previo = e.get('obreros', d.id);
    e.set('obreros', {
      id: d.id,
      nombre: d.nombre,
      rol: d.rol,
      jornal: d.jornal,
      telefono: d.telefono ?? '',
      nota: d.nota ?? '',
      cuadrilla_id: d.cuadrilla_id ?? null,
      activo: previo ? previo.activo : true,
    });
    if (previo && previo.cuadrilla_id !== (d.cuadrilla_id ?? null)) sacarEncargado(e, d.id, d.cuadrilla_id ?? null);
  },

  'obrero.baja'(e, d) {
    const o = obrero(e, d.id);
    e.set('obreros', { ...o, activo: false, cuadrilla_id: null });
    sacarEncargado(e, d.id);
  },

  'obrero.alta'(e, d) {
    const o = obrero(e, d.id);
    if (!o.activo) e.set('obreros', { ...o, activo: true });
  },

  'cuadrilla.guardar'(e, d) {
    const previa = e.get('cuadrillas', d.id);
    if (previa && !previa.activa) throw new Rechazo('Esa cuadrilla ya se cerró.');
    e.set('cuadrillas', {
      id: d.id,
      nombre: d.nombre,
      obra: d.obra ?? '',
      color: d.color ?? 'naranja',
      encargado_id: previa?.encargado_id ?? null,
      activa: true,
    });
    ponerEncargado(e, d.id, d.encargado_id ?? null);
  },

  'cuadrilla.integrantes'(e, d) {
    const cu = cuadrillaActiva(e, d.id);
    const ids = new Set(d.obrero_ids);
    for (const o of [...e.filas('obreros')]) {
      if (o.cuadrilla_id === d.id && !ids.has(o.id)) e.set('obreros', { ...o, cuadrilla_id: null });
    }
    for (const c of [...e.filas('cuadrillas')]) {
      if (c.id !== d.id && ids.has(c.encargado_id)) e.set('cuadrillas', { ...c, encargado_id: null });
    }
    for (const id of ids) {
      const o = e.get('obreros', id);
      if (o && o.activo && o.cuadrilla_id !== d.id) e.set('obreros', { ...o, cuadrilla_id: d.id });
    }
    if (cu.encargado_id && !ids.has(cu.encargado_id)) e.set('cuadrillas', { ...e.get('cuadrillas', d.id), encargado_id: null });
  },

  'cuadrilla.cerrar'(e, d, op) {
    const cu = e.get('cuadrillas', d.id);
    if (!cu) throw new Rechazo('La cuadrilla no existe.');
    if (!cu.activa) return;
    let n = 0;
    for (const s of [...e.filas('stock')]) {
      if (s.cuadrilla_id !== d.id || s.cantidad <= 0) continue;
      movimiento(e, op, n++, {
        herramienta_id: s.herramienta_id,
        tipo: 'devolucion',
        cantidad: s.cantidad,
        desde_id: d.id,
        responsable_id: cu.encargado_id,
        nota: 'Cierre de cuadrilla',
        fecha: d.fecha,
      });
      e.set('stock', { ...s, cantidad: 0 });
    }
    for (const o of [...e.filas('obreros')]) if (o.cuadrilla_id === d.id) e.set('obreros', { ...o, cuadrilla_id: null });
    e.set('cuadrillas', { ...cu, activa: false, encargado_id: null });
  },

  'asistencia.marcar'(e, d) {
    marcarDia(e, d.obrero_id, d.fecha, d.jornales, d.nota ?? null, false);
  },

  'asistencia.lote'(e, d) {
    for (const it of d.items) marcarDia(e, it.obrero_id, d.fecha, it.jornales, null, true);
  },

  'adelanto.crear'(e, d, op) {
    obrero(e, d.obrero_id);
    if (!(d.monto > 0)) throw new Rechazo('El monto tiene que ser mayor a 0.');
    if (e.get('adelantos', d.id)) throw new Rechazo('Ese adelanto ya estaba cargado.');
    e.set('adelantos', {
      id: d.id,
      obrero_id: d.obrero_id,
      tipo: 'adelanto',
      monto: d.monto,
      fecha: d.fecha,
      nota: d.nota ?? '',
      movimiento_id: null,
      anulado: false,
      creado: op.ts,
    });
  },

  'adelanto.borrar'(e, d) {
    const a = e.get('adelantos', d.id);
    if (!a) throw new Rechazo('El adelanto no existe.');
    if (a.anulado) return;
    const suyos = [...e.filas('adelantos')].filter((x) => x.obrero_id === a.obrero_id && !x.anulado);
    if (estadoAdelantos(suyos, descontadoDe(e, a.obrero_id)).get(a.id).descontado > 0) {
      throw new Rechazo('Ese adelanto ya se descontó en un pago. Para borrarlo, anulá ese pago.');
    }
    e.set('adelantos', { ...a, anulado: true });
  },

  'pago.crear'(e, d, op) {
    if (e.get('pagos', d.id)) throw new Rechazo('Ese pago ya estaba registrado.');
    if (new Set(d.items.map((i) => i.obrero_id)).size !== d.items.length) throw new Rechazo('Un obrero aparece dos veces en el pago.');
    for (const it of d.items) {
      const o = obrero(e, it.obrero_id);
      if (r2(o.jornal) !== r2(it.jornal)) throw new Rechazo(`${o.nombre}: el jornal cambió. Revisá el pago y volvé a confirmarlo.`);
      if (it.fechas.some((f) => f > d.hasta)) throw new Rechazo(`${o.nombre}: hay días posteriores al corte del pago.`);
      if (r2(it.bruto) !== r2(it.jornales * it.jornal) || r2(it.neto) !== r2(it.bruto + it.plus - it.descuento)) {
        throw new Rechazo(`${o.nombre}: las cuentas del pago no cierran.`);
      }
      if (it.descuento > it.bruto + it.plus + 0.01) throw new Rechazo(`${o.nombre}: el descuento supera lo que cobra.`);
      let suma = 0;
      for (const f of new Set(it.fechas)) {
        const a = e.get('asistencias', `${it.obrero_id}|${f}`);
        if (!a || !(a.jornales > 0) || a.pago_id) {
          throw new Rechazo(`${o.nombre}: hay días que ya se pagaron o cambiaron. Revisá el pago y volvé a confirmarlo.`);
        }
        suma += a.jornales;
      }
      if (Math.abs(suma - it.jornales) > 0.01) throw new Rechazo(`${o.nombre}: los días cambiaron desde que se armó el pago.`);
      if (it.descuento > deudaDe(e, it.obrero_id) + 0.01) throw new Rechazo(`${o.nombre}: el descuento supera los adelantos pendientes.`);
    }
    const total = (k) => r2(d.items.reduce((s, it) => s + (it[k] || 0), 0));
    e.set('pagos', {
      id: d.id,
      hasta: d.hasta,
      fecha: d.fecha,
      total_bruto: total('bruto'),
      total_plus: total('plus'),
      total_descuentos: total('descuento'),
      total_neto: total('neto'),
      nota: d.nota ?? '',
      anulado: false,
      creado: op.ts,
    });
    for (const it of d.items) {
      const fechas = [...new Set(it.fechas)].sort();
      e.set('pago_items', {
        id: it.id,
        pago_id: d.id,
        obrero_id: it.obrero_id,
        fechas,
        dias: fechas.length,
        jornales: it.jornales,
        jornal: it.jornal,
        bruto: it.bruto,
        plus: it.plus ?? 0,
        descuento: it.descuento ?? 0,
        neto: it.neto,
        nota: it.nota ?? '',
      });
      for (const f of fechas) {
        const a = e.get('asistencias', `${it.obrero_id}|${f}`);
        e.set('asistencias', { ...a, pago_id: d.id });
      }
    }
  },

  'pago.anular'(e, d) {
    const p = e.get('pagos', d.id);
    if (!p) throw new Rechazo('El pago no existe.');
    if (p.anulado) return;
    e.set('pagos', { ...p, anulado: true });
    for (const a of [...e.filas('asistencias')]) if (a.pago_id === d.id) e.set('asistencias', { ...a, pago_id: null });
  },

  'herramienta.crear'(e, d, op) {
    if (e.get('herramientas', d.id)) throw new Rechazo('Esa herramienta ya estaba cargada.');
    const cu = cuadrillaActiva(e, d.cuadrilla_id ?? null);
    e.set('herramientas', {
      id: d.id,
      nombre: d.nombre,
      tipo: d.tipo ?? 'herramienta',
      cantidad: d.cantidad,
      valor: d.valor ?? 0,
      nota: d.nota ?? '',
      activo: true,
    });
    movimiento(e, op, 0, { herramienta_id: d.id, tipo: 'alta', cantidad: d.cantidad, fecha: d.fecha });
    if (cu) {
      sumarStock(e, d.id, cu.id, d.cantidad);
      movimiento(e, op, 1, {
        herramienta_id: d.id,
        tipo: 'entrega',
        cantidad: d.cantidad,
        hacia_id: cu.id,
        responsable_id: cu.encargado_id,
        fecha: d.fecha,
      });
    }
  },

  'herramienta.editar'(e, d) {
    const h = herramientaActiva(e, d.id);
    e.set('herramientas', { ...e.get('herramientas', h.id), nombre: d.nombre, tipo: d.tipo, valor: d.valor ?? 0, nota: d.nota ?? '' });
  },

  'herramienta.cantidad'(e, d, op) {
    const h = herramientaActiva(e, d.id);
    const nueva = h.cantidad + d.delta;
    if (nueva < h.asignado) throw new Rechazo(`Hay ${h.asignado} de "${h.nombre}" en obras: el total no puede quedar en ${Math.max(nueva, 0)}.`);
    e.set('herramientas', { ...e.get('herramientas', d.id), cantidad: nueva });
    movimiento(e, op, 0, {
      herramienta_id: d.id,
      tipo: d.delta > 0 ? 'alta' : 'ajuste',
      cantidad: Math.abs(d.delta),
      nota: d.motivo ?? '',
      fecha: d.fecha,
    });
  },

  'herramienta.borrar'(e, d) {
    const h = herramientaActiva(e, d.id);
    if (h.asignado > 0) throw new Rechazo(`Hay ${h.asignado} de "${h.nombre}" en obras. Devolvelas al pañol antes de borrarla.`);
    e.set('herramientas', { ...e.get('herramientas', d.id), activo: false });
  },

  'herramienta.mover'(e, d, op) {
    if ((d.desde ?? null) === (d.hacia ?? null)) throw new Rechazo('El origen y el destino son el mismo lugar.');
    const desde = cuadrillaActiva(e, d.desde ?? null);
    const hacia = cuadrillaActiva(e, d.hacia ?? null);
    const tipo = !desde ? 'entrega' : !hacia ? 'devolucion' : 'traslado';
    const responsable = tipo === 'devolucion' ? desde.encargado_id : hacia.encargado_id;
    d.items.forEach((it, n) => {
      const h = herramientaActiva(e, it.herramienta_id);
      const hay = desde ? enCuadrilla(e, h.id, desde.id) : h.panol;
      if (hay < it.cantidad) throw new Rechazo(`No alcanza "${h.nombre}": en ${desde ? desde.nombre : 'el pañol'} hay ${hay}.`);
      if (desde) sumarStock(e, h.id, desde.id, -it.cantidad);
      if (hacia) sumarStock(e, h.id, hacia.id, it.cantidad);
      movimiento(e, op, n, {
        herramienta_id: h.id,
        tipo,
        cantidad: it.cantidad,
        desde_id: d.desde ?? null,
        hacia_id: d.hacia ?? null,
        responsable_id: responsable,
        nota: d.nota ?? '',
        fecha: d.fecha,
      });
    });
  },

  'herramienta.reclamo'(e, d, op) {
    const cu = cuadrillaActiva(e, d.cuadrilla_id ?? null);
    const h = herramientaActiva(e, d.herramienta_id);
    const hay = cu ? enCuadrilla(e, h.id, cu.id) : h.panol;
    if (hay < d.cantidad) throw new Rechazo(`No alcanza "${h.nombre}": en ${cu ? cu.nombre : 'el pañol'} hay ${hay}.`);
    if (cu) sumarStock(e, h.id, cu.id, -d.cantidad);
    e.set('herramientas', { ...e.get('herramientas', h.id), cantidad: h.cantidad - d.cantidad });
    const movId = movimiento(e, op, 0, {
      herramienta_id: h.id,
      tipo: d.tipo,
      cantidad: d.cantidad,
      desde_id: cu?.id ?? null,
      responsable_id: cu?.encargado_id ?? null,
      cargo: d.cargo?.monto ?? 0,
      nota: d.nota ?? '',
      fecha: d.fecha,
    });
    if (d.cargo) {
      obrero(e, d.cargo.obrero_id);
      const detalle = `${RECLAMOS[d.tipo]}: ${d.cantidad > 1 ? `${d.cantidad} × ` : ''}${h.nombre}${cu ? ` (${cu.nombre})` : ''}`;
      e.set('adelantos', {
        id: d.cargo.adelanto_id,
        obrero_id: d.cargo.obrero_id,
        tipo: 'cargo',
        monto: d.cargo.monto,
        fecha: d.fecha,
        nota: detalle.slice(0, 255),
        movimiento_id: movId,
        anulado: false,
        creado: op.ts,
      });
    }
  },
};

export const TIPOS = Object.keys(OPERACIONES);

/** Devuelve las tablas con la operación aplicada (no modifica las originales). */
export function aplicar(t, op) {
  const fn = OPERACIONES[op.tipo];
  if (!fn) throw new Rechazo('Operación desconocida.');
  const e = editor(t);
  fn(e, op.datos, op);
  return e.listo();
}

/**
 * Aplica una lista de operaciones salteando las que ya no son válidas (el
 * servidor las va a rechazar y se avisa ahí). Un error inesperado tampoco
 * frena al resto: se anota en la consola y se sigue.
 */
export function aplicarTodas(t, ops) {
  let r = t;
  for (const op of ops) {
    try {
      r = aplicar(r, op);
    } catch (err) {
      if (!(err instanceof Rechazo)) console.error(`Operación ${op.tipo} (${op.id}) falló al reaplicarse`, err);
    }
  }
  return r;
}
