// Pedidos al servidor. Sólo se usan para entrar, cambiar la clave y sincronizar:
// todo lo demás se hace en el teléfono (ver motor/).
const BASE = import.meta.env.VITE_API_URL || '/api';
const CLAVE_TOKEN = 'etem_token';
const CLAVE_USUARIO = 'etem_usuario';

export class ApiError extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status; // 0 = sin señal
  }
}

function leer(clave) {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave, valor) {
  try {
    if (valor) localStorage.setItem(clave, valor);
    else localStorage.removeItem(clave);
  } catch {
    /* sin almacenamiento: la sesión dura lo que dure la pestaña */
  }
}

export const leerToken = () => leer(CLAVE_TOKEN);
export const guardarToken = (t) => escribir(CLAVE_TOKEN, t);
export const leerUsuario = () => leer(CLAVE_USUARIO);
export const guardarUsuario = (u) => escribir(CLAVE_USUARIO, u);

let alVencer = () => {};
export const alVencerSesion = (fn) => {
  alVencer = fn;
};

const SIN_SENAL = 'Sin conexión. Revisá la señal e intentá de nuevo.';

export async function api(metodo, ruta, cuerpo, { espera = 20_000 } = {}) {
  // Si el teléfono sabe que no tiene red, ni se intenta (ahorra batería; al volver la señal se reintenta solo).
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ApiError(0, SIN_SENAL);
  const token = leerToken();
  // Con señal floja un pedido puede quedar colgado: se corta y se reintenta después.
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), espera);
  try {
    let res;
    try {
      res = await fetch(BASE + ruta, {
        method: metodo,
        headers: {
          ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
        signal: control.signal,
      });
    } catch {
      throw new ApiError(0, SIN_SENAL);
    }
    let datos = null;
    try {
      datos = await res.json();
    } catch {
      if (control.signal.aborted) throw new ApiError(0, SIN_SENAL);
    }
    if (res.status === 401 && ruta !== '/auth/login') alVencer();
    if (!res.ok) throw new ApiError(res.status, datos?.error || 'Algo salió mal. Probá de nuevo.');
    return datos;
  } finally {
    clearTimeout(reloj);
  }
}

export const post = (ruta, cuerpo = {}) => api('POST', ruta, cuerpo);

/** Para el motor: sube la cola (si hay) y baja lo que cambió desde el cursor. */
export async function sincronizar({ cursor, ops }) {
  const r = ops.length ? await api('POST', '/sync', { cursor, ops }, { espera: 45_000 }) : await api('GET', `/sync?cursor=${cursor}`, undefined, { espera: 30_000 });
  if (r?.token) guardarToken(r.token); // la sesión se renueva sola mientras se use
  return r;
}
