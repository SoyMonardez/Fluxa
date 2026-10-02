// Reglas de pago (ver docs/DISENO.md §5). Funciones puras, sin base de datos.

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Liquida a un obrero.
 * - bruto = jornales × jornal
 * - el descuento de adelantos no puede superar la deuda ni lo que cobra (bruto + plus)
 * - sin descuento indicado, se descuenta todo lo posible
 */
function liquidar({ jornales, jornal, deuda = 0, plus = 0, descuento = null }) {
  const bruto = r2(jornales * jornal);
  const plusOk = r2(Math.max(0, Number(plus) || 0));
  const tope = r2(Math.max(0, Math.min(Number(deuda) || 0, bruto + plusOk)));
  const desc = descuento == null ? tope : r2(Math.min(Math.max(0, Number(descuento) || 0), tope));
  return { bruto, plus: plusOk, tope, descuento: desc, neto: r2(bruto + plusOk - desc) };
}

/**
 * Reparte lo ya descontado entre los adelantos, del más viejo al más nuevo
 * (orden de carga). Devuelve Map(id → { descontado, pendiente }).
 */
function estadoAdelantos(adelantos, descontado) {
  let resto = r2(Math.max(0, descontado));
  const estado = new Map();
  for (const a of [...adelantos].sort((x, y) => x.id - y.id)) {
    const usado = r2(Math.min(resto, a.monto));
    resto = r2(resto - usado);
    estado.set(a.id, { descontado: usado, pendiente: r2(a.monto - usado) });
  }
  return estado;
}

const deudaDe = (adelantos, descontado) => r2(Math.max(0, adelantos - descontado));

module.exports = { r2, liquidar, estadoAdelantos, deudaDe };
