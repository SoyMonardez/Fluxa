// Estado global mínimo. Se guarda una copia en el teléfono para abrir al instante.
import { useSyncExternalStore } from 'react';
import { leerToken } from './api';
import { hoy, sumarDias } from './fechas';

const CLAVE_CACHE = 'etem_cache_v2';
const CLAVE_USUARIO = 'etem_usuario';

const leerJSON = (clave) => {
  try {
    return JSON.parse(localStorage.getItem(clave) || 'null');
  } catch {
    return null;
  }
};

const cache = leerToken() ? leerJSON(CLAVE_CACHE) : null;

let estado = {
  sesion: leerToken() ? { usuario: localStorage.getItem(CLAVE_USUARIO) || 'admin' } : null,
  listo: Boolean(cache),
  obreros: cache?.obreros ?? [],
  cuadrillas: cache?.cuadrillas ?? [],
  herramientas: cache?.herramientas ?? [],
  stock: cache?.stock ?? [],
  // { 'YYYY-MM-DD': { [obreroId]: { jornales, nota, pagado } } }
  asistencia: cache?.asistencia ?? {},
  cola: 0, // marcas de asistencia sin subir
  enLinea: typeof navigator === 'undefined' ? true : navigator.onLine,
  version: 0, // sube cuando cambian pagos/asistencia en el servidor (para recargar vistas)
};

const subs = new Set();
let guardarPendiente = null;

function persistir() {
  if (!estado.sesion) return;
  clearTimeout(guardarPendiente);
  guardarPendiente = setTimeout(() => {
    const limite = sumarDias(hoy(), -21);
    const asistencia = Object.fromEntries(Object.entries(estado.asistencia).filter(([f]) => f >= limite));
    try {
      localStorage.setItem(
        CLAVE_CACHE,
        JSON.stringify({
          obreros: estado.obreros,
          cuadrillas: estado.cuadrillas,
          herramientas: estado.herramientas,
          stock: estado.stock,
          asistencia,
        })
      );
    } catch {
      /* almacenamiento lleno o bloqueado: no es grave */
    }
  }, 400);
}

export function setEstado(cambio) {
  const parcial = typeof cambio === 'function' ? cambio(estado) : cambio;
  if (!parcial) return;
  estado = { ...estado, ...parcial };
  subs.forEach((f) => f());
  persistir();
}

export const getEstado = () => estado;

export const useEstado = (selector) =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => selector(estado)
  );

export function borrarCache() {
  try {
    localStorage.removeItem(CLAVE_CACHE);
  } catch {
    /* nada */
  }
}

export function guardarUsuario(usuario) {
  try {
    localStorage.setItem(CLAVE_USUARIO, usuario);
  } catch {
    /* nada */
  }
}

/** Reemplaza (o agrega) un elemento por id. */
export const upsert = (lista, item) =>
  lista.some((x) => x.id === item.id) ? lista.map((x) => (x.id === item.id ? item : x)) : [...lista, item];
