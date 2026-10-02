const test = require('node:test');
const assert = require('node:assert/strict');
const { liquidar, estadoAdelantos, deudaDe } = require('../lib/calculos');

test('ejemplo del diseño: 6½ jornales, plus y descuento parcial', () => {
  const r = liquidar({ jornales: 6.5, jornal: 45000, deuda: 50000, plus: 5000, descuento: 30000 });
  assert.equal(r.bruto, 292500);
  assert.equal(r.plus, 5000);
  assert.equal(r.descuento, 30000);
  assert.equal(r.neto, 267500);
  assert.equal(r.tope, 50000);
});

test('sin descuento indicado se descuenta todo lo posible', () => {
  assert.equal(liquidar({ jornales: 5, jornal: 30000, deuda: 20000 }).descuento, 20000);
  assert.equal(liquidar({ jornales: 5, jornal: 30000, deuda: 20000 }).neto, 130000);
});

test('el descuento nunca supera lo que cobra ni la deuda', () => {
  const r = liquidar({ jornales: 1, jornal: 30000, deuda: 100000 });
  assert.equal(r.descuento, 30000);
  assert.equal(r.neto, 0);
  assert.equal(liquidar({ jornales: 1, jornal: 30000, deuda: 5000, descuento: 99999 }).descuento, 5000);
  assert.equal(liquidar({ jornales: 1, jornal: 30000, deuda: 5000, descuento: -10 }).descuento, 0);
});

test('dejar el adelanto para otro pago', () => {
  const r = liquidar({ jornales: 4, jornal: 38000, deuda: 20000, descuento: 0 });
  assert.equal(r.neto, 152000);
});

test('medio día y doble jornada', () => {
  assert.equal(liquidar({ jornales: 0.5 + 2 + 1.5, jornal: 31000 }).bruto, 124000);
});

test('estado de adelantos: lo descontado se aplica del más viejo al más nuevo', () => {
  const adelantos = [
    { id: 3, monto: 15000 },
    { id: 1, monto: 10000 },
    { id: 2, monto: 20000 },
  ];
  const e = estadoAdelantos(adelantos, 25000);
  assert.deepEqual(e.get(1), { descontado: 10000, pendiente: 0 });
  assert.deepEqual(e.get(2), { descontado: 15000, pendiente: 5000 });
  assert.deepEqual(e.get(3), { descontado: 0, pendiente: 15000 });
});

test('la deuda no es negativa', () => {
  assert.equal(deudaDe(10000, 25000), 0);
  assert.equal(deudaDe(45000, 25000), 20000);
});
