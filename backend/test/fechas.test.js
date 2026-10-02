const test = require('node:test');
const assert = require('node:assert/strict');
const { esFecha, sumarDias, cierreDeSemana, semanaDePago, diaSemana } = require('../lib/fechas');

test('valida fechas reales', () => {
  assert.ok(esFecha('2026-10-02'));
  assert.ok(esFecha('2028-02-29'));
  assert.ok(!esFecha('2026-02-30'));
  assert.ok(!esFecha('2026-10-2'));
  assert.ok(!esFecha(undefined));
});

test('sumar días cruza meses y años', () => {
  assert.equal(sumarDias('2026-09-30', 1), '2026-10-01');
  assert.equal(sumarDias('2026-01-01', -1), '2025-12-31');
});

test('la semana de pago va de sábado a viernes', () => {
  assert.equal(diaSemana('2026-10-02'), 5); // viernes
  assert.deepEqual(semanaDePago('2026-10-02'), { desde: '2026-09-26', hasta: '2026-10-02' });
  assert.deepEqual(semanaDePago('2026-09-28'), { desde: '2026-09-26', hasta: '2026-10-02' }); // lunes
  // un sábado ya es de la semana siguiente
  assert.deepEqual(semanaDePago('2026-10-03'), { desde: '2026-10-03', hasta: '2026-10-09' });
  assert.equal(cierreDeSemana('2026-10-04'), '2026-10-09'); // domingo
});
