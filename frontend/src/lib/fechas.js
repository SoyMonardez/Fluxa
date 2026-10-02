// Fechas de calendario como texto 'YYYY-MM-DD', siempre en hora local del teléfono.
// (Nunca toISOString: de noche en Argentina daría el día siguiente.)

const pad = (n) => String(n).padStart(2, '0');
const aTexto = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const aDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // mediodía: a salvo de cambios de horario
};

export const VIERNES = 5; // día de pago

export const hoy = () => aTexto(new Date());

export function sumarDias(fecha, n) {
  const d = aDate(fecha);
  d.setDate(d.getDate() + n);
  return aTexto(d);
}

export const diaSemana = (fecha) => aDate(fecha).getDay(); // 0 = domingo

/** Semana de pago: de sábado a viernes. */
export function semanaDePago(fecha) {
  const hasta = sumarDias(fecha, (VIERNES - diaSemana(fecha) + 7) % 7);
  return { desde: sumarDias(hasta, -6), hasta };
}

export const diasDesde = (desde, n = 7) => Array.from({ length: n }, (_, i) => sumarDias(desde, i));

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const INICIALES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const partes = (fecha) => fecha.split('-').map(Number);

/** "2/10" */
export function corta(fecha) {
  const [, m, d] = partes(fecha);
  return `${d}/${m}`;
}

/** "vie 2/10" */
export const conDia = (fecha) => `${DIAS_CORTOS[diaSemana(fecha)]} ${corta(fecha)}`;

/** "viernes 2 de octubre" */
export function larga(fecha) {
  const [, m, d] = partes(fecha);
  return `${DIAS[diaSemana(fecha)]} ${d} de ${MESES[m - 1]}`;
}

export const nombreDia = (fecha) => DIAS[diaSemana(fecha)];
export const diaCorto = (fecha) => DIAS_CORTOS[diaSemana(fecha)];
export const inicial = (fecha) => INICIALES[diaSemana(fecha)];
export const numeroDia = (fecha) => partes(fecha)[2];

/** "hoy", "ayer", "mañana" o "vie 2/10" */
export function relativa(fecha) {
  const h = hoy();
  if (fecha === h) return 'hoy';
  if (fecha === sumarDias(h, -1)) return 'ayer';
  if (fecha === sumarDias(h, 1)) return 'mañana';
  return conDia(fecha);
}

/** "sáb 26/9 → vie 2/10" */
export const rango = ({ desde, hasta }) => `${conDia(desde)} → ${conDia(hasta)}`;

/** "recién", "hace 5 min", "hace 2 h", "ayer", "hace 3 días" (ms = momento en milisegundos). */
export function hace(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 45) return 'recién';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}
