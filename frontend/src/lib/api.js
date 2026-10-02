const BASE = import.meta.env.VITE_API_URL || '/api';
const CLAVE_TOKEN = 'etem_token';

export class ApiError extends Error {
  constructor(status, mensaje, datos = null) {
    super(mensaje);
    this.status = status;
    this.datos = datos;
    this.sinRed = status === 0;
  }
}

export function leerToken() {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

export function guardarToken(t) {
  try {
    if (t) localStorage.setItem(CLAVE_TOKEN, t);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    /* sin almacenamiento: la sesión dura lo que dure la pestaña */
  }
}

let alVencer = () => {};
export const alVencerSesion = (fn) => {
  alVencer = fn;
};

export async function api(metodo, ruta, cuerpo) {
  const token = leerToken();
  let res;
  try {
    res = await fetch(BASE + ruta, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Sin conexión. Revisá la señal e intentá de nuevo.');
  }
  let datos = null;
  try {
    datos = await res.json();
  } catch {
    /* respuesta vacía */
  }
  if (res.status === 401 && !ruta.startsWith('/auth/')) alVencer();
  if (!res.ok) throw new ApiError(res.status, datos?.error || 'Algo salió mal. Probá de nuevo.', datos);
  return datos;
}

export const get = (ruta) => api('GET', ruta);
export const post = (ruta, cuerpo = {}) => api('POST', ruta, cuerpo);
export const put = (ruta, cuerpo = {}) => api('PUT', ruta, cuerpo);
export const del = (ruta) => api('DELETE', ruta);
