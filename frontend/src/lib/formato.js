const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

/** "$ 45.000" / "−$ 5.000" (con espacio que no corta la línea) */
export function pesos(n) {
  const v = Math.round(Number(n) || 0);
  return `${v < 0 ? '−' : ''}$\u00a0${nf.format(Math.abs(v))}`;
}

/** "+ $ 5.000" y "− $ 5.000" sin que el signo quede solo en otra línea. */
export const mas = (n) => `+\u00a0${pesos(Math.abs(n))}`;
export const menos = (n) => `−\u00a0${pesos(Math.abs(n))}`;

/** "45.000" (sin signo, para inputs) */
export const miles = (n) => nf.format(Math.round(Number(n) || 0));

/** Lee "45.000", "45000" o "$ 45.000" como número. */
export function leerMonto(texto) {
  const limpio = String(texto ?? '').replace(/[^\d]/g, '');
  return limpio ? Number(limpio) : 0;
}

/** Jornales: 0.5 → "½", 1.5 → "1½", 6.5 → "6½", 2 → "2" */
export function jornales(n) {
  const v = Number(n) || 0;
  const entero = Math.floor(v);
  const medio = Math.abs(v - entero - 0.5) < 0.01;
  if (medio) return entero === 0 ? '½' : `${entero}½`;
  return String(Math.round(v * 10) / 10).replace('.', ',');
}

export const JORNADAS = [
  { valor: 0, corto: 'Falta', largo: 'No vino' },
  { valor: 0.5, corto: '½', largo: 'Medio día' },
  { valor: 1, corto: '1', largo: 'Jornal' },
  { valor: 1.5, corto: '1½', largo: 'Medio día más' },
  { valor: 2, corto: '2', largo: 'Doble jornada' },
];

export const ROLES = ['Capataz', 'Oficial', 'Medio oficial', 'Ayudante'];
const ORDEN_ROL = Object.fromEntries(ROLES.map((r, i) => [r, i]));
export const ordenRol = (rol) => ORDEN_ROL[rol] ?? ROLES.length;

export function iniciales(nombre = '') {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

export const primerNombre = (nombre = '') => nombre.trim().split(/\s+/)[0] || nombre;

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** "Capataz" → "capataces", "Ayudante" → "ayudantes", "Oficial" → "oficiales" */
export function pluralRol(rol = '') {
  const r = rol.toLowerCase();
  if (r.endsWith('z')) return `${r.slice(0, -1)}ces`;
  return /[aeiou]$/.test(r) ? `${r}s` : `${r}es`;
}

export const COLORES = {
  naranja: '#f97316',
  azul: '#3b82f6',
  verde: '#22c55e',
  violeta: '#8b5cf6',
  rosa: '#ec4899',
  celeste: '#06b6d4',
  amarillo: '#eab308',
  gris: '#78716c',
};
export const colorDe = (nombre) => COLORES[nombre] || COLORES.gris;

/** Link de WhatsApp (Argentina: agrega 549 si hace falta). */
export function whatsapp(telefono, texto = '') {
  let n = String(telefono || '').replace(/\D/g, '');
  if (!n) return null;
  n = n.replace(/^0/, '');
  if (!n.startsWith('54')) n = `549${n}`;
  return `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}
