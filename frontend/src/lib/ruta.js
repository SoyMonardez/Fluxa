// Navegación entre las 5 secciones. Usa replaceState: el "atrás" del celular
// cierra hojas o sale de la app, no recorre pestañas.
import { useSyncExternalStore } from 'react';

export const SECCIONES = ['asistencia', 'pagos', 'cuadrillas', 'herramientas', 'obreros'];

const leer = () => {
  const s = location.pathname.split('/')[1];
  return SECCIONES.includes(s) ? s : 'asistencia';
};

let actual = typeof window !== 'undefined' ? leer() : 'asistencia';
const subs = new Set();

export function ir(seccion) {
  if (seccion === actual) return;
  actual = seccion;
  history.replaceState(history.state, '', `/${seccion}`);
  subs.forEach((f) => f());
}

export const useSeccion = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => actual
  );
