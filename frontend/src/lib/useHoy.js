// Fecha de hoy que se actualiza sola: si la app quedó abierta de un día para
// otro, al volver a mirarla ya está en el día nuevo.
import { useSyncExternalStore } from 'react';
import { hoy } from './fechas';

function suscribir(avisar) {
  const t = setInterval(avisar, 60_000);
  document.addEventListener('visibilitychange', avisar);
  window.addEventListener('focus', avisar);
  return () => {
    clearInterval(t);
    document.removeEventListener('visibilitychange', avisar);
    window.removeEventListener('focus', avisar);
  };
}

export const useHoy = () => useSyncExternalStore(suscribir, hoy);
