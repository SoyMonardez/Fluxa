// Todo lo que cambia datos pasa por acá. Cada acción se aplica al instante en el
// teléfono (con o sin señal) y el motor la sube sola. Si una regla no se cumple
// (ej. un día ya pagado) la acción tira el error para mostrarlo y no cambia nada.
import { elegirAlmacen } from '../motor/almacen';
import { crearVista, detallePago } from '../motor/derivar';
import { crearMotor } from '../motor/motor';
import { nuevoId } from '../motor/uuid';
import { alVencerSesion, guardarToken, guardarUsuario, post, sincronizar } from './api';
import { avisar, avisarError } from './avisos';
import { hoy } from './fechas';
import { cerrarTodo } from './hojas';
import { getEstado, setEstado } from './store';

/* ── Motor ──────────────────────────────────────────────────────────── */

// IndexedDB se abre una sola vez; mientras tanto el motor espera.
const almacenListo = elegirAlmacen();
const almacen = {
  leerTodo: async () => (await almacenListo).leerTodo(),
  agregarOps: async (ops) => (await almacenListo).agregarOps(ops),
  guardarSync: async (x) => (await almacenListo).guardarSync(x),
  borrarTodo: async () => (await almacenListo).borrarTodo(),
};

function sesionVencida() {
  if (getEstado().sesion && !getEstado().sesionVencida) setEstado({ sesionVencida: true });
}

const motor = crearMotor({
  almacen,
  red: { sincronizar },
  avisos: {
    rechazos(lista) {
      for (const { error } of lista.slice(0, 3)) avisar(`No se guardó: ${error}`, { tipo: 'error', duracion: 8000 });
      if (lista.length > 3) avisar(`Y ${lista.length - 3} cambios más no se pudieron guardar.`, { tipo: 'error', duracion: 8000 });
    },
    subidos: (n) => avisar(n === 1 ? 'Se subió el cambio hecho sin señal ✓' : `Se subieron los ${n} cambios hechos sin señal ✓`),
    sesionVencida,
  },
});
alVencerSesion(sesionVencida);

const vista = crearVista();
motor.suscribir((e) =>
  setEstado({
    ...vista(e.tablas),
    cargado: e.cargado,
    listo: e.listo,
    pendientes: e.pendientes,
    red: e.red,
    errorRed: e.error,
    ultimaSync: e.ultima,
  })
);

if (getEstado().sesion) motor.arrancar();

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setEstado({ enLinea: true });
    motor.sincronizar();
  });
  window.addEventListener('offline', () => setEstado({ enLinea: false }));
  // Al volver a la app (o cada tanto mientras está abierta) se baja lo que hicieron otros.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - (getEstado().ultimaSync ?? 0) > 15_000) motor.sincronizar();
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') motor.sincronizar();
  }, 45_000);
}

export const sincronizarAhora = () => motor.sincronizar();
export const tablas = () => motor.tablas();

const hacer = (tipo, datos) => motor.ejecutar(tipo, datos);
const texto = (s) => String(s ?? '').trim();

/* ── Sesión ─────────────────────────────────────────────────────────── */

export async function ingresar(usuario, clave) {
  const r = await post('/auth/login', { usuario, clave });
  guardarToken(r.token);
  guardarUsuario(r.usuario);
  setEstado({ sesion: { usuario: r.usuario }, sesionVencida: false });
  // Si la sesión había vencido, sigue con la cola donde estaba.
  motor.reanudar();
}

/** Borra lo guardado en el teléfono (también lo que no se subió: HojaMenu avisa antes). */
export async function salir() {
  guardarToken(null);
  cerrarTodo();
  setEstado({ sesion: null, sesionVencida: false });
  await motor.reiniciar();
}

export async function cambiarClave(actual, nueva) {
  const r = await post('/auth/clave', { actual, nueva });
  if (r?.token) guardarToken(r.token);
}

/* ── Asistencia ─────────────────────────────────────────────────────── */

/** jornales: 0 (falta), 0.5, 1, 1.5 o 2. nota: undefined = no tocarla. Avisa si no se puede. */
export function marcar(obreroId, fecha, jornales, nota) {
  try {
    hacer('asistencia.marcar', { obrero_id: obreroId, fecha, jornales, ...(nota !== undefined ? { nota: texto(nota) } : {}) });
    return true;
  } catch (e) {
    avisarError(e);
    return false;
  }
}

/** Marca varios a la vez (salteando días pagados). Devuelve lo anterior para poder deshacer. */
export function marcarVarios(fecha, items) {
  const dia = getEstado().asistencia[fecha] || {};
  const libres = items.filter((it) => !dia[it.obrero_id]?.pagado);
  const previos = libres.map((it) => ({ obrero_id: it.obrero_id, jornales: dia[it.obrero_id]?.jornales ?? 0 }));
  if (!libres.length) return previos;
  try {
    hacer('asistencia.lote', { fecha, items: libres });
  } catch (e) {
    avisarError(e);
  }
  return previos;
}

/* ── Obreros y adelantos ────────────────────────────────────────────── */

export function guardarObrero(d, id = null) {
  const oid = id ?? nuevoId();
  hacer('obrero.guardar', {
    id: oid,
    nombre: texto(d.nombre),
    rol: texto(d.rol),
    jornal: d.jornal,
    telefono: texto(d.telefono),
    nota: texto(d.nota),
    cuadrilla_id: d.cuadrilla_id ?? null,
  });
  return motor.tablas().obreros.get(oid);
}

export const darDeBaja = (id) => hacer('obrero.baja', { id });
export const reactivar = (id) => hacer('obrero.alta', { id });

export function darAdelanto(obreroId, monto, fecha, nota = '') {
  const id = nuevoId();
  hacer('adelanto.crear', { id, obrero_id: obreroId, monto, fecha, nota: texto(nota) });
  return { id };
}

export const borrarAdelanto = (id) => hacer('adelanto.borrar', { id });

/* ── Cuadrillas ─────────────────────────────────────────────────────── */

/** Crea o edita; devuelve el id. */
export function guardarCuadrilla(d, id = null) {
  const cid = id ?? nuevoId();
  hacer('cuadrilla.guardar', { id: cid, nombre: texto(d.nombre), obra: texto(d.obra), color: d.color, encargado_id: d.encargado_id ?? null });
  return cid;
}

export const definirIntegrantes = (id, obreroIds) => hacer('cuadrilla.integrantes', { id, obrero_ids: obreroIds });
export const cerrarCuadrilla = (id) => hacer('cuadrilla.cerrar', { id, fecha: hoy() });

/* ── Herramientas ───────────────────────────────────────────────────── */

/** Alta (con cuadrilla_id opcional: se entrega ahí) o edición (si cambia la cantidad, se ajusta). */
export function guardarHerramienta(d, id = null) {
  const datos = { nombre: texto(d.nombre), tipo: d.tipo, valor: d.valor || 0, nota: texto(d.nota) };
  if (!id) {
    const hid = nuevoId();
    hacer('herramienta.crear', { id: hid, ...datos, cantidad: d.cantidad, cuadrilla_id: d.cuadrilla_id ?? null, fecha: hoy() });
    return motor.tablas().herramientas.get(hid);
  }
  const delta = d.cantidad - motor.tablas().herramientas.get(id).cantidad;
  motor.ejecutarVarias([
    ['herramienta.editar', { id, ...datos }],
    ...(delta ? [['herramienta.cantidad', { id, delta, motivo: delta > 0 ? 'Alta' : 'Corrección', fecha: hoy() }]] : []),
  ]);
  return motor.tablas().herramientas.get(id);
}

export const sumarUnidades = (id, n, motivo) => hacer('herramienta.cantidad', { id, delta: n, motivo, fecha: hoy() });
export const borrarHerramienta = (id) => hacer('herramienta.borrar', { id });

/** desde/hacia: id de cuadrilla o null (pañol). items: [{ herramienta_id, cantidad }] */
export const moverHerramientas = (desde, hacia, items, nota = '') => hacer('herramienta.mover', { desde, hacia, items, nota: texto(nota), fecha: hoy() });

/** cargo: { obrero_id, monto } o null — se cobra como un adelanto. */
export function registrarReclamo(d) {
  hacer('herramienta.reclamo', {
    herramienta_id: d.herramienta_id,
    cuadrilla_id: d.cuadrilla_id ?? null,
    tipo: d.tipo,
    cantidad: d.cantidad,
    nota: texto(d.nota),
    fecha: d.fecha ?? hoy(),
    cargo: d.cargo ? { adelanto_id: nuevoId(), obrero_id: d.cargo.obrero_id, monto: d.cargo.monto } : null,
  });
}

/* ── Pagos ──────────────────────────────────────────────────────────── */

/** items: los del próximo pago (con sus asistencias, descuento y plus). Devuelve el pago registrado. */
export function pagar({ hasta, fecha, nota, items }) {
  const id = nuevoId();
  hacer('pago.crear', {
    id,
    hasta,
    fecha,
    nota: texto(nota),
    items: items.map((i) => ({
      id: nuevoId(),
      obrero_id: i.obrero_id,
      fechas: i.asistencias.map((a) => a.fecha),
      jornales: i.jornales,
      jornal: i.jornal,
      bruto: i.bruto,
      plus: i.plus,
      descuento: i.descuento,
      neto: i.neto,
      nota: texto(i.nota),
    })),
  });
  return detallePago(motor.tablas(), id);
}

export const anularPago = (id) => hacer('pago.anular', { id });
