// Instalar la app en el teléfono (PWA). Android/Chrome avisa con
// "beforeinstallprompt" y se guarda ese aviso para usarlo desde un botón;
// en iPhone se hace a mano: Compartir → Agregar a inicio.
import { useSyncExternalStore } from 'react';

let aviso = null;
const subs = new Set();
const emitir = () => subs.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    aviso = e;
    emitir();
  });
  window.addEventListener('appinstalled', () => {
    aviso = null;
    emitir();
  });
}

export const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/** El aviso del navegador (o null si no se puede instalar desde un botón). */
export const useInstalable = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => aviso
  );

export async function instalar() {
  if (!aviso) return false;
  const a = aviso;
  a.prompt();
  const r = await a.userChoice.catch(() => null);
  aviso = null;
  emitir();
  return r?.outcome === 'accepted';
}
