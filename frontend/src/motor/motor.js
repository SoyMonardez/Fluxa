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
  const sinGuardar = new Map();
  let guardando = Promise.resolve();
  let errorLocal = null;
  let almacenTemporal = false;
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
    pagosConfirmados: base.pagos,
    pendientes: ops.length,
    cargado,
    listo: meta.ultima != null, // ya sincronizó alguna vez (una base vacía tiene cursor 0)
    red: estadoRed,
    error,
    ultima: meta.ultima,
    errorLocal,
    almacenTemporal,
    sinGuardar: sinGuardar.size,
  });

  function publicar() {
    const e = estado();
    for (const f of subs) f(e);
  }

  function guardarPendientes() {
    const gen = generacion;
    guardando = guardando.catch(() => {}).then(async () => {
      if (gen !== generacion || !sinGuardar.size) return;
      const lista = [...sinGuardar.values()];
      try {
        await almacen.agregarOps(lista);
        if (gen !== generacion) return;
        for (const op of lista) sinGuardar.delete(op.id);
        errorLocal = null;
      } catch {
        if (gen !== generacion) return;
        errorLocal = 'No se pudo guardar en este dispositivo. No cierres la app; liberá espacio y volvé a sincronizar.';
        throw Object.assign(new Error(errorLocal), { status: 507 });
      } finally {
        if (gen === generacion) publicar();
      }
    });
    return guardando;
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
        const { datos, ops: guardadasOps, temporal = false } = await almacen.leerTodo();
        if (gen !== generacion) return;
        const t = vacias();
        for (const n of NOMBRES) if (datos[`t.${n}`] instanceof Map) t[n] = datos[`t.${n}`];
        base = t;
        almacenTemporal = temporal;
        errorLocal = null;
        meta = { ...meta, ...(datos.meta ?? {}) };
        ops = guardadasOps;
        ultimoTs = ops.reduce((m, o) => Math.max(m, o.ts), 0);
      } catch (e) {
        console.error('No se pudo leer lo guardado en el teléfono', e);
        errorLocal = 'No se pudieron abrir los datos guardados. Cerrá otras pestañas de la app y volvé a intentar.';
        estadoRed = 'error';
        error = errorLocal;
        arranque = null;
        publicar();
        return;
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
    if (errorLocal) throw new Rechazo(errorLocal);
    if (!lista.length) return [];
    // Cada operación es posterior a la anterior (los adelantos se descuentan en ese orden).
    const ts = Math.max(ahora(), ultimoTs + 1);
    const nuevas = lista.map(([tipo, datos], i) => ({ id: nuevoId(), tipo, datos, ts: ts + i }));
    let t = visibles;
    for (const op of nuevas) t = aplicar(t, op);
    for (const op of nuevas) op.n = clave(op.ts, ++numero);
    ultimoTs = nuevas.at(-1).ts;
    ops = [...ops, ...nuevas];
    visibles = t;
    for (const op of nuevas) sinGuardar.set(op.id, op);
    guardarPendientes().catch(() => {}); // el error queda visible y la cola se conserva para reintentar
    publicar();
    pedirSync(ESPERA_OP);
    return nuevas;
  }

  const ejecutar = (tipo, datos) => ejecutarVarias([[tipo, datos]])[0];

  /* ── Sincronización ────────────────────────────────────────────────── */

  function sincronizar() {
    if (!cargado && errorLocal) return arrancar();
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
    if (ops.length && !detenido) pedirSync(0);
  }

  async function vuelta(gen) {
    await guardarPendientes();
    if (gen !== generacion) return;
    const lote = ops.slice(0, LOTE);
    const r = await red.sincronizar({ cursor: meta.cursor, ops: lote.map(({ id, tipo, ts, datos }) => ({ id, tipo, ts, datos })) });
    if (gen !== generacion) return;
    if (lote.length && !Array.isArray(r?.resultados)) throw Object.assign(new Error('Respuesta inválida del servidor.'), { status: 500 });

    const resultados = new Map((r.resultados ?? []).map((x) => [x.id, x]));
    const resueltas = lote.filter((op) => resultados.has(op.id));
    const rechazos = resueltas.filter((op) => !resultados.get(op.id).ok).map((op) => ({ op, error: resultados.get(op.id).error || 'No se pudo guardar.' }));
    const ids = new Set(resueltas.map((op) => op.id));

    const nuevaBase = r.completo ? desdeCambios(r.cambios ?? {}) : fusionar(base, r.cambios ?? {});
    const nuevaMeta = { ...meta, cursor: r.cursor ?? meta.cursor, ultima: ahora() };
    // La foto y su cursor se guardan juntos. Otra pestaña puede haber escrito
    // cualquier tabla: no alcanza con comparar con nuestra copia en memoria.
    const kv = { meta: nuevaMeta };
    for (const n of NOMBRES) kv[`t.${n}`] = nuevaBase[n];
    try {
      await almacen.guardarSync({ kv, quitar: resueltas.map((op) => op.n) });
    } catch {
      errorLocal = 'No se pudo guardar la sincronización. No cierres la app; liberá espacio y volvé a intentar.';
      throw Object.assign(new Error(errorLocal), { status: 507 });
    }
    if (gen !== generacion) return;
    base = nuevaBase;
    meta = nuevaMeta;
    ops = ops.filter((op) => !ids.has(op.id));
    visibles = aplicarTodas(base, ops);
    errorLocal = null;

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
    sinGuardar.clear();
    errorLocal = null;
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
      await guardando.catch(() => {});
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
