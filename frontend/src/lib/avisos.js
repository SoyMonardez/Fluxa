// Avisos (toasts) que bajan desde arriba. Pueden tener una acción, ej. "Deshacer".
import { useSyncExternalStore } from 'react';

let lista = [];
const subs = new Set();
const emitir = () => subs.forEach((f) => f());
let siguiente = 1;

export function avisar(texto, { tipo = 'ok', accion = null, duracion } = {}) {
  const id = siguiente++;
  lista = [...lista.slice(-2), { id, texto, tipo, accion }];
  emitir();
  setTimeout(() => quitar(id), duracion ?? (accion ? 5000 : tipo === 'error' ? 4500 : 2600));
  return id;
}

export const avisarError = (e) => avisar(e?.message || String(e), { tipo: 'error' });

export function quitar(id) {
  if (!lista.some((a) => a.id === id)) return;
  lista = lista.filter((a) => a.id !== id);
  emitir();
}

export const useAvisos = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => lista
  );
