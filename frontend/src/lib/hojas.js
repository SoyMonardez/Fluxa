// Pila de hojas (paneles que suben desde abajo). Cada hoja abierta agrega una
// entrada al historial, así el botón "atrás" del celular la cierra.
import { useSyncExternalStore } from 'react';

// Tipo de hoja → componente (se registran una vez en App).
const registro = {};
export const registrarHojas = (mapa) => Object.assign(registro, mapa);
export const componenteDe = (tipo) => registro[tipo];

let pila = [];
const subs = new Set();
const emitir = () => subs.forEach((f) => f());
let siguiente = 1;

export function abrir(tipo, props = {}) {
  pila = [...pila, { id: siguiente++, tipo, props }];
  history.pushState({ etemHoja: pila.length }, '');
  emitir();
}

/** Cambia la hoja de arriba por otra (sin tocar el historial). */
export function reemplazar(tipo, props = {}) {
  if (!pila.length) return abrir(tipo, props);
  pila = [...pila.slice(0, -1), { id: siguiente++, tipo, props }];
  emitir();
}

export function cerrar(n = 1) {
  const k = Math.min(n, pila.length);
  if (!k) return;
  pila = pila.slice(0, pila.length - k);
  emitir();
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
      pila = pila.slice(0, n);
      emitir();
    }
  });
}

export const usePila = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => pila
  );
