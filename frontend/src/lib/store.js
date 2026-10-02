// Estado global de la pantalla. Los datos los arma el motor (ver acciones.js);
// acá sólo se guardan y se reparten a los componentes.
import { useSyncExternalStore } from 'react';
import { vacias } from '../motor/tablas';
import { leerToken, leerUsuario } from './api';

let estado = {
  sesion: leerToken() ? { usuario: leerUsuario() || 'admin' } : null,
  sesionVencida: false,
  cargado: false, // ya se leyó lo guardado en el teléfono
  listo: false, // hay datos para mostrar
  // Vista (motor/derivar.js)
  tablas: vacias(),
  obreros: [],
  cuadrillas: [],
  herramientas: [],
  stock: [],
  asistencia: {}, // { 'YYYY-MM-DD': { [obreroId]: { jornales, nota, pagado } } }
  // Sincronización
  pendientes: 0, // cambios hechos en el teléfono que todavía no subieron
  red: 'ok', // 'ok' | 'subiendo' | 'sin-senal' | 'error' | 'sesion'
  errorRed: null,
  ultimaSync: null,
  enLinea: typeof navigator === 'undefined' ? true : navigator.onLine,
};

const subs = new Set();

export function setEstado(cambio) {
  const parcial = typeof cambio === 'function' ? cambio(estado) : cambio;
  if (!parcial) return;
  estado = { ...estado, ...parcial };
  subs.forEach((f) => f());
}

export const getEstado = () => estado;

export const useEstado = (selector) =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => selector(estado)
  );
