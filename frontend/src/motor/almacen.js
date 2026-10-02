// Guardado en el teléfono (IndexedDB): las tablas, la cola de cambios sin subir y
// el cursor de sincronización. Sigue ahí aunque se cierre la app o no haya señal.
// Si el navegador no deja usar IndexedDB (modo privado viejo), todo queda en memoria.

const NOMBRE = 'etem';
const VERSION = 1;

let conexion = null;

function abrir() {
  conexion ??= new Promise((ok, mal) => {
    if (typeof indexedDB === 'undefined') return mal(new Error('Sin IndexedDB'));
    const pedido = indexedDB.open(NOMBRE, VERSION);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      // keyPath "n": "momento-número-pestaña" (ordena en el orden en que se hicieron los cambios).
      if (!db.objectStoreNames.contains('ops')) db.createObjectStore('ops', { keyPath: 'n' });
    };
    pedido.onsuccess = () => {
      const db = pedido.result;
      // Si otra pestaña actualiza la base, se cierra ésta para no trabarla.
      db.onversionchange = () => db.close();
      ok(db);
    };
    pedido.onerror = () => mal(pedido.error);
    pedido.onblocked = () => mal(new Error('IndexedDB bloqueada por otra pestaña'));
  });
  return conexion;
}

const terminar = (tx) =>
  new Promise((ok, mal) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => mal(tx.error);
    tx.onabort = () => mal(tx.error ?? new Error('Transacción cancelada'));
  });

const pedir = (req) =>
  new Promise((ok, mal) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
  });

/** Almacén real (IndexedDB). Cada función devuelve una promesa. */
export const almacenIDB = {
  /** { datos: { clave: valor }, ops: [op ordenadas] } */
  async leerTodo() {
    const db = await abrir();
    const tx = db.transaction(['kv', 'ops'], 'readonly');
    const kv = tx.objectStore('kv');
    const [claves, valores, ops] = await Promise.all([pedir(kv.getAllKeys()), pedir(kv.getAll()), pedir(tx.objectStore('ops').getAll())]);
    return { datos: Object.fromEntries(claves.map((k, i) => [k, valores[i]])), ops };
  },

  async agregarOps(ops) {
    const db = await abrir();
    const tx = db.transaction('ops', 'readwrite');
    for (const op of ops) tx.objectStore('ops').put(op);
    return terminar(tx);
  },

  /** Guarda lo que llegó del servidor y saca de la cola lo que ya se resolvió, todo junto. */
  async guardarSync({ kv = {}, quitar = [] }) {
    const db = await abrir();
    const tx = db.transaction(['kv', 'ops'], 'readwrite');
    for (const [k, v] of Object.entries(kv)) tx.objectStore('kv').put(v, k);
    for (const n of quitar) tx.objectStore('ops').delete(n);
    return terminar(tx);
  },

  async borrarTodo() {
    const db = await abrir();
    const tx = db.transaction(['kv', 'ops'], 'readwrite');
    tx.objectStore('kv').clear();
    tx.objectStore('ops').clear();
    return terminar(tx);
  },
};

/** Almacén en memoria: para pruebas y para navegadores sin IndexedDB. */
export function almacenMemoria() {
  let kv = {};
  let ops = new Map();
  return {
    async leerTodo() {
      return { datos: { ...kv }, ops: [...ops.values()].sort((a, b) => (a.n < b.n ? -1 : a.n > b.n ? 1 : 0)) };
    },
    async agregarOps(lista) {
      for (const op of lista) ops.set(op.n, op);
    },
    async guardarSync({ kv: nuevos = {}, quitar = [] }) {
      kv = { ...kv, ...nuevos };
      for (const n of quitar) ops.delete(n);
    },
    async borrarTodo() {
      kv = {};
      ops = new Map();
    },
  };
}

/** IndexedDB si se puede; si no, memoria (la app anda igual, pero no guarda entre sesiones). */
export async function elegirAlmacen() {
  try {
    await abrir();
    // Pide que el navegador no borre estos datos para liberar espacio.
    navigator.storage?.persist?.().catch(() => {});
    return almacenIDB;
  } catch (e) {
    console.warn('Sin IndexedDB, los datos quedan en memoria:', e);
    return almacenMemoria();
  }
}
