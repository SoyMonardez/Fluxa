// Avisos (toasts) que bajan desde arriba. Pueden tener una acción, ej. "Deshacer".
import { useSyncExternalStore } from 'react';

const SALIDA_MS = 200;

let lista = [];
const subs = new Set();
const emitir = () => subs.forEach((f) => f());
let siguiente = 1;

export function avisar(texto, { tipo = 'ok', accion = null, duracion } = {}) {
  const id = siguiente++;
  // Como mucho 3 a la vista: los más viejos se van.
  const vivos = lista.filter((a) => !a.saliendo);
  for (const a of vivos.slice(0, Math.max(0, vivos.length - 2))) quitar(a.id);
  lista = [...lista, { id, texto, tipo, accion }];
  emitir();
  setTimeout(() => quitar(id), duracion ?? (accion ? 5000 : tipo === 'error' ? 4500 : 2600));
  return id;
}

export const avisarError = (e) => avisar(e?.message || String(e), { tipo: 'error' });

export function quitar(id) {
  if (!lista.some((a) => a.id === id && !a.saliendo)) return;
  lista = lista.map((a) => (a.id === id ? { ...a, saliendo: true } : a));
  emitir();
  setTimeout(() => {
    lista = lista.filter((a) => a.id !== id);
    emitir();
  }, SALIDA_MS);
}

export const useAvisos = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => lista
  );
