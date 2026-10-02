// Fechas de calendario como texto 'YYYY-MM-DD'. Se calculan en UTC para que
// ningún cálculo dependa de la zona horaria del servidor.

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const VIERNES = 5; // día de pago

const aDate = (fecha) => {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const aTexto = (date) => date.toISOString().slice(0, 10);

function esFecha(s) {
  return typeof s === 'string' && RE_FECHA.test(s) && aTexto(aDate(s)) === s;
}

function sumarDias(fecha, n) {
  const d = aDate(fecha);
  d.setUTCDate(d.getUTCDate() + n);
  return aTexto(d);
}

// 0 = domingo … 6 = sábado
const diaSemana = (fecha) => aDate(fecha).getUTCDay();

// La semana de pago va de sábado a viernes: devuelve el viernes que la cierra.
function cierreDeSemana(fecha) {
  return sumarDias(fecha, (VIERNES - diaSemana(fecha) + 7) % 7);
}

function semanaDePago(fecha) {
  const hasta = cierreDeSemana(fecha);
  return { desde: sumarDias(hasta, -6), hasta };
}

// Hoy en la zona horaria de la empresa.
function hoyLocal(tz = process.env.APP_TZ || 'America/Argentina/Buenos_Aires') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

module.exports = { esFecha, sumarDias, diaSemana, cierreDeSemana, semanaDePago, hoyLocal };
