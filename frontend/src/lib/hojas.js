// Pila de hojas (paneles que suben desde abajo). Cada hoja abierta agrega una
// entrada al historial, así el botón "atrás" del celular la cierra. Al cerrarse,
// la hoja se sigue dibujando un momento para animar la salida.
import { useSyncExternalStore } from 'react';

// Tipo de hoja → componente (se registran una vez en App).
const registro = {};
export const registrarHojas = (mapa) => Object.assign(registro, mapa);
export const componenteDe = (tipo) => registro[tipo];

const SALIDA_MS = 260;

let pila = []; // abiertas
let saliendo = []; // cerrándose (todavía en pantalla)
let dibujo = []; // lo que se dibuja: pila + saliendo
const subs = new Set();
let siguiente = 1;

function emitir() {
  dibujo = [...pila, ...saliendo];
  subs.forEach((f) => f());
}

function sacar(cerradas) {
  if (!cerradas.length) return;
  saliendo = [...saliendo, ...cerradas.map((h) => ({ ...h, saliendo: true }))];
  emitir();
  const ids = new Set(cerradas.map((h) => h.id));
  setTimeout(() => {
    saliendo = saliendo.filter((h) => !ids.has(h.id));
    emitir();
  }, SALIDA_MS);
}

export function abrir(tipo, props = {}) {
  pila = [...pila, { id: siguiente++, tipo, props }];
  history.pushState({ etemHoja: pila.length }, '');
  emitir();
}

/** Cambia la hoja de arriba por otra (sin tocar el historial): el contenido cambia en el lugar. */
export function reemplazar(tipo, props = {}) {
  if (!pila.length) return abrir(tipo, props);
  pila = [...pila.slice(0, -1), { id: siguiente++, tipo, props, reemplazo: true }];
  emitir();
}

export function cerrar(n = 1) {
  const k = Math.min(n, pila.length);
  if (!k) return;
  const cerradas = pila.slice(pila.length - k);
  pila = pila.slice(0, pila.length - k);
  sacar(cerradas);
  history.go(-k);
}

export const cerrarTodo = () => cerrar(pila.length);
export const hayHojas = () => pila.length > 0;

if (typeof window !== 'undefined') {
  // Si se recargó la página con hojas abiertas, se limpia ese estado.
  if (history.state?.etemHoja) history.replaceState(null, '');
  window.addEventListener('popstate', (e) => {
    const n = e.state?.etemHoja ?? 0;
    if (n < pila.length) {
      const cerradas = pila.slice(n);
      pila = pila.slice(0, n);
      sacar(cerradas);
    }
  });
}

/** [{ id, tipo, props, saliendo?, reemplazo? }] */
export const usePila = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => dibujo
  );

/** Cantidad de hojas abiertas (sin contar las que se están yendo). */
export const useHayHojas = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => pila.length > 0
  );
