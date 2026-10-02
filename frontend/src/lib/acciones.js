// Todo lo que cambia datos pasa por acá. Los cambios se ven en pantalla al instante
// y, si el servidor rechaza algo, se vuelve atrás y se avisa.
import { del, get, guardarToken, post, put, alVencerSesion } from './api';
import { avisar } from './avisos';
import { encolar, largoCola, marcasEnCola, sacar, vaciarCola } from './cola';
import { cerrarTodo } from './hojas';
import { borrarCache, getEstado, guardarUsuario, setEstado, upsert } from './store';
import { diasDesde } from './fechas';

/* ── Sesión ─────────────────────────────────────────────────────────── */

// Al entrar, Shell carga los datos (y sube la asistencia que haya quedado en cola).
export async function ingresar(usuario, clave) {
  const r = await post('/auth/login', { username: usuario, password: clave });
  guardarToken(r.token);
  guardarUsuario(r.username);
  setEstado({ sesion: { usuario: r.username } });
}

/** conservarCola: si la sesión venció, la asistencia sin subir se guarda para después de volver a entrar. */
export function salir({ conservarCola = false } = {}) {
  guardarToken(null);
  borrarCache();
  if (!conservarCola) vaciarCola();
  cerrarTodo();
  setEstado({ sesion: null, listo: false, obreros: [], cuadrillas: [], herramientas: [], stock: [], asistencia: {}, cola: 0 });
}

alVencerSesion(() => {
  if (getEstado().sesion) {
    salir({ conservarCola: true });
    avisar('La sesión venció. Volvé a ingresar.', { tipo: 'error' });
  }
});

export const cambiarClave = (actual, nueva) => post('/auth/clave', { actual, nueva });

/* ── Carga ──────────────────────────────────────────────────────────── */

export async function cargarEstado() {
  const d = await get('/estado');
  setEstado({ obreros: d.obreros, cuadrillas: d.cuadrillas, herramientas: d.herramientas, stock: d.stock, listo: true });
}

const rangosCargados = new Map(); // 'desde|hasta' → ms

export async function cargarAsistencia(desde, hasta, { forzar = false } = {}) {
  const k = `${desde}|${hasta}`;
  if (!forzar && Date.now() - (rangosCargados.get(k) || 0) < 20_000) return;
  rangosCargados.set(k, Date.now());
  const filas = await get(`/asistencia?desde=${desde}&hasta=${hasta}`);
  setEstado((s) => {
    const asistencia = { ...s.asistencia };
    const n = Math.round((new Date(hasta) - new Date(desde)) / 86_400_000) + 1;
    for (const f of diasDesde(desde, n)) asistencia[f] = {};
    for (const r of filas) asistencia[r.fecha][r.obrero_id] = { jornales: r.jornales, nota: r.nota, pagado: r.pagado };
    // Lo que todavía está en la cola manda sobre lo del servidor.
    for (const m of marcasEnCola()) {
      if (!asistencia[m.fecha]) continue;
      if (m.jornales) asistencia[m.fecha][m.obrero_id] = { jornales: m.jornales, nota: m.nota ?? '', pagado: false };
      else delete asistencia[m.fecha][m.obrero_id];
    }
    return { asistencia };
  });
}

export function invalidarAsistencia() {
  rangosCargados.clear();
  setEstado((s) => ({ version: s.version + 1 }));
}

export async function iniciar() {
  setEstado({ cola: largoCola() });
  await subirCola();
  await cargarEstado();
}

/* ── Asistencia ─────────────────────────────────────────────────────── */

// Aplica un día en pantalla y ajusta lo pendiente de cobro del obrero.
function aplicarDia(obreroId, fecha, nuevo) {
  setEstado((s) => {
    const dia = { ...(s.asistencia[fecha] || {}) };
    const previo = dia[obreroId];
    if (nuevo) dia[obreroId] = nuevo;
    else delete dia[obreroId];
    const antes = previo && !previo.pagado ? previo.jornales : 0;
    const despues = nuevo && !nuevo.pagado ? nuevo.jornales : 0;
    const obreros =
      antes === despues
        ? s.obreros
        : s.obreros.map((o) =>
            o.id === obreroId
              ? {
                  ...o,
                  pend_jornales: Math.max(0, Math.round((o.pend_jornales + despues - antes) * 10) / 10),
                  pend_dias: Math.max(0, o.pend_dias + (despues > 0) - (antes > 0)),
                }
              : o
          );
    return { asistencia: { ...s.asistencia, [fecha]: dia }, obreros };
  });
}

// Las marcas de un mismo obrero y día se mandan en orden (dos toques rápidos no se pisan).
const cadenas = new Map();
const secuencia = new Map();
function enOrden(clave, fn) {
  const p = (cadenas.get(clave) || Promise.resolve()).catch(() => {}).then(fn);
  cadenas.set(clave, p);
  return p;
}

const DIA_PAGADO = 'Ese día ya está pagado. Para cambiarlo, anulá el pago en Pagos → Historial.';

/** jornales: 0 (falta), 0.5, 1, 1.5 o 2. nota: undefined = no tocarla. */
export async function marcar(obreroId, fecha, jornales, nota) {
  const previo = getEstado().asistencia[fecha]?.[obreroId] || null;
  if (previo?.pagado) {
    avisar(DIA_PAGADO, { tipo: 'error' });
    return false;
  }
  const clave = `${obreroId}|${fecha}`;
  const n = (secuencia.get(clave) || 0) + 1;
  secuencia.set(clave, n);
  const marca = { obrero_id: obreroId, fecha, jornales, ...(nota !== undefined ? { nota } : {}) };
  aplicarDia(obreroId, fecha, jornales ? { jornales, nota: nota ?? previo?.nota ?? '', pagado: false } : null);

  if (!navigator.onLine) {
    setEstado({ cola: encolar(marca) });
    return true;
  }
  setEstado({ cola: sacar(marca) });
  try {
    await enOrden(clave, () => put('/asistencia', marca));
    return true;
  } catch (e) {
    if (e.sinRed) {
      setEstado({ cola: encolar(marca) });
      return true;
    }
    if (secuencia.get(clave) === n) aplicarDia(obreroId, fecha, e.datos?.registro ?? previo);
    avisar(e.message, { tipo: 'error' });
    return false;
  }
}

/**
 * Marca varios a la vez. items: [{ obrero_id, jornales }].
 * Devuelve los valores anteriores para poder deshacer.
 */
export async function marcarVarios(fecha, items) {
  const dia = getEstado().asistencia[fecha] || {};
  const libres = items.filter((it) => !dia[it.obrero_id]?.pagado);
  const previos = libres.map((it) => ({ obrero_id: it.obrero_id, jornales: dia[it.obrero_id]?.jornales ?? 0 }));
  for (const it of libres) {
    aplicarDia(it.obrero_id, fecha, it.jornales ? { jornales: it.jornales, nota: dia[it.obrero_id]?.nota ?? '', pagado: false } : null);
  }
  if (!libres.length) return previos;
  const aCola = () => {
    let largo = 0;
    for (const it of libres) largo = encolar({ obrero_id: it.obrero_id, fecha, jornales: it.jornales });
    setEstado({ cola: largo });
  };
  if (!navigator.onLine) {
    aCola();
    return previos;
  }
  try {
    for (const it of libres) sacar({ obrero_id: it.obrero_id, fecha });
    setEstado({ cola: largoCola() });
    await post('/asistencia/lote', { fecha, items: libres });
  } catch (e) {
    if (e.sinRed) aCola();
    else {
      for (const p of previos) aplicarDia(p.obrero_id, fecha, p.jornales ? { ...dia[p.obrero_id] } : null);
      avisar(e.message, { tipo: 'error' });
    }
  }
  return previos;
}

let subiendo = false;
export async function subirCola() {
  if (subiendo || !navigator.onLine) return;
  const marcas = marcasEnCola();
  if (!marcas.length) return;
  subiendo = true;
  let rechazadas = 0;
  try {
    for (const m of marcas) {
      try {
        await put('/asistencia', m);
        sacar(m);
      } catch (e) {
        if (e.sinRed || e.status === 401) break;
        sacar(m);
        rechazadas += 1;
      }
    }
  } finally {
    subiendo = false;
    const quedan = largoCola();
    setEstado({ cola: quedan });
    if (!quedan) {
      avisar(rechazadas ? `Asistencia subida. ${rechazadas} marca(s) no se pudieron guardar (día pagado).` : 'Asistencia sin señal subida ✓', {
        tipo: rechazadas ? 'error' : 'ok',
      });
      invalidarAsistencia();
      cargarEstado().catch(() => {});
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setEstado({ enLinea: true });
    subirCola();
  });
  window.addEventListener('offline', () => setEstado({ enLinea: false }));
  setInterval(() => {
    if (largoCola()) subirCola();
  }, 30_000);
}

/* ── Obreros ────────────────────────────────────────────────────────── */

export const actualizarObrero = (id, cambios) =>
  setEstado((s) => ({ obreros: s.obreros.map((o) => (o.id === id ? { ...o, ...cambios } : o)) }));

function aplicarObrero(r) {
  setEstado((s) => ({ obreros: upsert(s.obreros, r.obrero), cuadrillas: r.cuadrillas }));
  return r.obrero;
}

export const guardarObrero = async (datos, id) =>
  aplicarObrero(id ? await put(`/obreros/${id}`, datos) : await post('/obreros', datos));
export const darDeBaja = async (id) => aplicarObrero(await del(`/obreros/${id}`));
export const reactivar = async (id) => aplicarObrero(await post(`/obreros/${id}/alta`));
export const cuentaDe = (id) => get(`/obreros/${id}/cuenta`);

/* ── Adelantos ──────────────────────────────────────────────────────── */

export async function darAdelanto(obreroId, monto, fecha, nota = '') {
  const r = await post('/adelantos', { obrero_id: obreroId, monto, fecha, nota });
  actualizarObrero(obreroId, { deuda: r.deuda });
  return r.adelanto;
}

export async function borrarAdelanto(id) {
  const r = await del(`/adelantos/${id}`);
  actualizarObrero(r.obrero_id, { deuda: r.deuda });
  return r;
}

/* ── Cuadrillas ─────────────────────────────────────────────────────── */

function aplicarEquipos(r) {
  const cuadrillaDe = new Map(r.asignaciones.map((a) => [a.id, a.cuadrilla_id]));
  setEstado((s) => ({
    cuadrillas: r.cuadrillas,
    obreros: s.obreros.map((o) => (cuadrillaDe.has(o.id) && cuadrillaDe.get(o.id) !== o.cuadrilla_id ? { ...o, cuadrilla_id: cuadrillaDe.get(o.id) } : o)),
    ...(r.stock ? { stock: r.stock } : {}),
  }));
  return r;
}

export async function guardarCuadrilla(datos, id) {
  const r = aplicarEquipos(id ? await put(`/cuadrillas/${id}`, datos) : await post('/cuadrillas', datos));
  return id ?? r.id;
}
export const definirIntegrantes = async (id, obreroIds) => aplicarEquipos(await put(`/cuadrillas/${id}/integrantes`, { obrero_ids: obreroIds }));
export const cerrarCuadrilla = async (id) => aplicarEquipos(await del(`/cuadrillas/${id}`));

/* ── Herramientas ───────────────────────────────────────────────────── */

function aplicarHerramientas(r) {
  const ids = new Set(r.herramienta_ids);
  setEstado((s) => {
    let herramientas = s.herramientas;
    for (const h of r.herramientas) if (h) herramientas = upsert(herramientas, h);
    herramientas = [...herramientas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const stock = [...s.stock.filter((x) => !ids.has(x.herramienta_id)), ...r.stock];
    return { herramientas, stock };
  });
  if (r.obrero) setEstado((s) => ({ obreros: upsert(s.obreros, r.obrero) }));
  return r;
}

export async function guardarHerramienta(datos, id) {
  const r = aplicarHerramientas(id ? await put(`/herramientas/${id}`, datos) : await post('/herramientas', datos));
  return r.herramientas[0];
}

export async function borrarHerramienta(id) {
  await del(`/herramientas/${id}`);
  setEstado((s) => ({ herramientas: s.herramientas.filter((h) => h.id !== id), stock: s.stock.filter((x) => x.herramienta_id !== id) }));
}

/** desde/hacia: id de cuadrilla o null (pañol). items: [{ herramienta_id, cantidad }] */
export const moverHerramientas = async (desde, hacia, items, nota = '') =>
  aplicarHerramientas(await post('/herramientas/mover', { desde, hacia, items, nota }));

export const registrarReclamo = async (datos) => aplicarHerramientas(await post('/herramientas/reclamo', datos));

export function movimientos({ herramientaId, cuadrillaId, limite = 40 } = {}) {
  const q = new URLSearchParams({ limite: String(limite) });
  if (herramientaId) q.set('herramienta_id', herramientaId);
  if (cuadrillaId) q.set('cuadrilla_id', cuadrillaId);
  return get(`/herramientas/movimientos?${q}`);
}

/* ── Pagos ──────────────────────────────────────────────────────────── */

export const previewPago = (hasta) => get(`/pagos/preview?hasta=${hasta}`);
export const listaPagos = () => get('/pagos');
export const detallePago = (id) => get(`/pagos/${id}`);

async function trasPago() {
  invalidarAsistencia();
  await cargarEstado();
}

export async function pagar(datos) {
  const r = await post('/pagos', datos);
  await trasPago();
  return r;
}

export async function anularPago(id) {
  await del(`/pagos/${id}`);
  await trasPago();
}

