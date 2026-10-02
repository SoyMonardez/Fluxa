// El motor de datos. Cada cambio se aplica al instante en el teléfono, se guarda
// en una cola y se sube cuando hay señal. Lo que se ve en pantalla es
// "lo último que confirmó el servidor + los cambios que todavía no subieron":
// después de cada sincronización esos cambios se vuelven a aplicar encima.
// Si el servidor rechaza alguno (ej. dos celulares pagaron el mismo día sin
// señal), desaparece y se avisa por qué.
import { aplicar, aplicarTodas, Rechazo } from './reducir.js';
import { desdeCambios, fusionar, NOMBRES, vacias } from './tablas.js';
import { nuevoId } from './uuid.js';

const LOTE = 100; // operaciones por pedido
const ESPERA_OP = 400; // ms entre un cambio y la subida (junta toques seguidos)
const MAX_ESPERA = 60_000; // reintentos: 3 s, 6 s, 12 s… hasta 1 minuto
const MAX_VUELTAS = 20;

/**
 * almacen: { leerTodo, agregarOps, guardarSync, borrarTodo } (ver almacen.js)
 * red: { sincronizar({ cursor, ops }) → respuesta de /api/sync } — tira error con .status (0 = sin señal)
 * avisos: { rechazos(lista), subidos(n), sesionVencida() }
 */
export function crearMotor({ almacen, red, avisos = {}, programar = setTimeout, desprogramar = clearTimeout, ahora = Date.now }) {
  let base = vacias(); // lo que confirmó el servidor
  let ops = []; // cambios sin confirmar, en orden
  let visibles = base; // base + ops
  let meta = { cursor: 0, ultima: null };
  let guardadas = {}; // tabla → Map guardado en el almacén (para no reescribir lo que no cambió)
  let numero = 0; // operaciones creadas por esta pestaña
  let ultimoTs = 0;
  // Clave de cada operación en el almacén: ordena por momento y no choca con otra
  // pestaña de la app abierta al mismo tiempo (cada una tiene su propia cola en memoria).
  const pestana = Math.random().toString(36).slice(2, 8);
  const clave = (ts, n) => `${String(ts).padStart(13, '0')}-${String(n).padStart(6, '0')}-${pestana}`;
  let arranque = null;
  let cargado = false;
  let detenido = true;
  let generacion = 0; // cambia al cerrar sesión: lo que estaba en vuelo se descarta
  let estadoRed = 'ok'; // 'ok' | 'subiendo' | 'sin-senal' | 'error' | 'sesion'
  let error = null;
  let enCurso = null;
  let otraVez = false;
  let timer = null;
  let fallos = 0;
  let huboCorte = false;
  let subidasTrasCorte = 0;
  const subs = new Set();

  const estado = () => ({
    tablas: visibles,
    pendientes: ops.length,
    cargado,
    listo: meta.ultima != null, // ya sincronizó alguna vez (una base vacía tiene cursor 0)
    red: estadoRed,
    error,
    ultima: meta.ultima,
  });

  function publicar() {
    const e = estado();
    for (const f of subs) f(e);
  }

  function pedirSync(ms = ESPERA_OP) {
    if (detenido) return;
    desprogramar(timer);
    timer = programar(() => {
      timer = null;
      sincronizar();
    }, ms);
  }

  /* ── Arranque: lo guardado en el teléfono, después el servidor ─────── */

  function arrancar() {
    arranque ??= (async () => {
      const gen = generacion;
      try {
        const { datos, ops: guardadasOps } = await almacen.leerTodo();
        if (gen !== generacion) return;
        const t = vacias();
        for (const n of NOMBRES) if (datos[`t.${n}`] instanceof Map) t[n] = datos[`t.${n}`];
        base = t;
        guardadas = { ...t };
        meta = { ...meta, ...(datos.meta ?? {}) };
        ops = guardadasOps;
        ultimoTs = ops.reduce((m, o) => Math.max(m, o.ts), 0);
      } catch (e) {
        console.error('No se pudo leer lo guardado en el teléfono', e);
      }
      visibles = aplicarTodas(base, ops);
      cargado = true;
      detenido = false;
      publicar();
      sincronizar();
    })();
    return arranque;
  }

  /* ── Cambios ───────────────────────────────────────────────────────── */

  /** Aplica varias operaciones juntas: si alguna no vale (Rechazo), no se aplica ninguna. */
  function ejecutarVarias(lista) {
    if (!cargado) throw new Rechazo('Un momento: se están cargando los datos.');
    // Cada operación es posterior a la anterior (los adelantos se descuentan en ese orden).
    const ts = Math.max(ahora(), ultimoTs + 1);
    const nuevas = lista.map(([tipo, datos], i) => ({ id: nuevoId(), tipo, datos, ts: ts + i }));
    let t = visibles;
    for (const op of nuevas) t = aplicar(t, op);
    for (const op of nuevas) op.n = clave(op.ts, ++numero);
    ultimoTs = nuevas.at(-1).ts;
    ops = [...ops, ...nuevas];
    visibles = t;
    almacen.agregarOps(nuevas).catch((e) => console.error('No se pudo guardar el cambio en el teléfono', e));
    publicar();
    pedirSync(ESPERA_OP);
    return nuevas;
  }

  const ejecutar = (tipo, datos) => ejecutarVarias([[tipo, datos]])[0];

  /* ── Sincronización ────────────────────────────────────────────────── */

  function sincronizar() {
    if (detenido || !cargado) return Promise.resolve();
    if (enCurso) {
      otraVez = true;
      return enCurso;
    }
    desprogramar(timer);
    timer = null;
    const gen = generacion;
    enCurso = ciclo(gen).finally(() => {
      enCurso = null;
      if (otraVez && gen === generacion) pedirSync(0);
    });
    return enCurso;
  }

  async function ciclo(gen) {
    let vueltas = 0;
    do {
      otraVez = false;
      if (ops.length && estadoRed !== 'subiendo') {
        estadoRed = 'subiendo';
        publicar();
      }
      try {
        await vuelta(gen);
      } catch (e) {
        if (gen === generacion) fallar(e);
        return;
      }
      if (gen !== generacion) return;
      fallos = 0;
      estadoRed = 'ok';
      error = null;
      publicar();
    } while ((otraVez || ops.length > 0) && ++vueltas < MAX_VUELTAS && !detenido);
  }

  async function vuelta(gen) {
    const lote = ops.slice(0, LOTE);
    const r = await red.sincronizar({ cursor: meta.cursor, ops: lote.map(({ id, tipo, ts, datos }) => ({ id, tipo, ts, datos })) });
    if (gen !== generacion) return;
    if (lote.length && !Array.isArray(r?.resultados)) throw Object.assign(new Error('Respuesta inválida del servidor.'), { status: 500 });

    const resultados = new Map((r.resultados ?? []).map((x) => [x.id, x]));
    const resueltas = lote.filter((op) => resultados.has(op.id));
    const rechazos = resueltas.filter((op) => !resultados.get(op.id).ok).map((op) => ({ op, error: resultados.get(op.id).error || 'No se pudo guardar.' }));
    const ids = new Set(resueltas.map((op) => op.id));

    base = r.completo ? desdeCambios(r.cambios ?? {}) : fusionar(base, r.cambios ?? {});
    ops = ops.filter((op) => !ids.has(op.id));
    meta = { ...meta, cursor: r.cursor ?? meta.cursor, ultima: ahora() };
    visibles = aplicarTodas(base, ops);

    const aGuardar = base;
    const kv = { meta };
    for (const n of NOMBRES) if (aGuardar[n] !== guardadas[n]) kv[`t.${n}`] = aGuardar[n];
    try {
      await almacen.guardarSync({ kv, quitar: resueltas.map((op) => op.n) });
      if (gen === generacion) guardadas = { ...aGuardar };
    } catch (e) {
      console.error('No se pudo guardar en el teléfono', e);
    }
    if (gen !== generacion) return;

    if (huboCorte) subidasTrasCorte += resueltas.length - rechazos.length;
    if (rechazos.length) avisos.rechazos?.(rechazos);
    if (huboCorte && !ops.length) {
      if (subidasTrasCorte) avisos.subidos?.(subidasTrasCorte);
      huboCorte = false;
      subidasTrasCorte = 0;
    }
  }

  function fallar(e) {
    if (e?.status === 401) {
      detenido = true;
      estadoRed = 'sesion';
      error = e.message;
      publicar();
      avisos.sesionVencida?.();
      return;
    }
    fallos += 1;
    if (!e?.status) {
      estadoRed = 'sin-senal';
      error = null;
      if (ops.length) huboCorte = true;
    } else {
      estadoRed = 'error';
      error = e.message || 'No se pudo sincronizar.';
      console.error('Error al sincronizar', e);
    }
    publicar();
    // Con cambios en cola (o sin datos todavía) se reintenta solo, cada vez más espaciado.
    if (ops.length || meta.ultima == null) pedirSync(Math.min(MAX_ESPERA, 3000 * 2 ** (fallos - 1)));
  }

  /* ── Sesión ────────────────────────────────────────────────────────── */

  /** Después de volver a ingresar (la sesión había vencido): sigue con la cola donde estaba. */
  function reanudar() {
    if (!cargado) return arrancar();
    detenido = false;
    fallos = 0;
    estadoRed = 'ok';
    error = null;
    publicar();
    return sincronizar();
  }

  /** Cerrar sesión: se borra todo lo guardado en el teléfono. */
  async function reiniciar() {
    generacion += 1;
    detenido = true;
    desprogramar(timer);
    timer = null;
    otraVez = false;
    base = vacias();
    ops = [];
    visibles = base;
    meta = { cursor: 0, ultima: null };
    guardadas = {};
    numero = 0;
    fallos = 0;
    huboCorte = false;
    subidasTrasCorte = 0;
    estadoRed = 'ok';
    error = null;
    arranque = Promise.resolve();
    cargado = true;
    publicar();
    try {
      await almacen.borrarTodo();
    } catch (e) {
      console.error('No se pudo borrar lo guardado', e);
    }
  }

  return {
    arrancar,
    ejecutar,
    ejecutarVarias,
    sincronizar,
    pedirSync,
    reanudar,
    reiniciar,
    estado,
    tablas: () => visibles,
    pendientes: () => ops,
    suscribir(f) {
      subs.add(f);
      return () => subs.delete(f);
    },
  };
}
