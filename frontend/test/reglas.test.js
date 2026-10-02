import assert from 'node:assert/strict';
import { test } from 'node:test';
import { semanaDePago } from '../src/lib/fechas.js';
import { cuentas, estadoAdelantos, liquidar, previewPago } from '../src/motor/calculos.js';
import { crearVista, cuentaObrero, detallePago, listaPagos, movimientosDe } from '../src/motor/derivar.js';
import { aplicar, Rechazo } from '../src/motor/reducir.js';
import { vacias } from '../src/motor/tablas.js';
import { nuevoId } from '../src/motor/uuid.js';

let reloj = 1_700_000_000_000;
const op = (tipo, datos) => ({ id: nuevoId(), tipo, datos, ts: (reloj += 1000) });

/** Aplica una lista de [tipo, datos] y devuelve las tablas. */
const correr = (t, ...lista) => lista.reduce((acc, [tipo, datos]) => aplicar(acc, op(tipo, datos)), t);

function base() {
  const ids = { juan: nuevoId(), pedro: nuevoId(), funes: nuevoId(), roldan: nuevoId(), amoladora: nuevoId() };
  const t = correr(
    vacias(),
    ['cuadrilla.guardar', { id: ids.funes, nombre: 'Plaza Funes', color: 'naranja' }],
    ['cuadrilla.guardar', { id: ids.roldan, nombre: 'Roldán', color: 'azul' }],
    ['obrero.guardar', { id: ids.juan, nombre: 'Juan', rol: 'Oficial', jornal: 50000, cuadrilla_id: ids.funes }],
    ['obrero.guardar', { id: ids.pedro, nombre: 'Pedro', rol: 'Ayudante', jornal: 40000, cuadrilla_id: ids.funes }],
    ['herramienta.crear', { id: ids.amoladora, nombre: 'Amoladora', tipo: 'herramienta', cantidad: 4, valor: 25000, fecha: '2026-09-28' }]
  );
  return { t, ...ids };
}

const item = (obreroId, fechas, jornales, jornal, descuento = 0, plus = 0) => ({
  id: nuevoId(),
  obrero_id: obreroId,
  fechas,
  jornales,
  jornal,
  bruto: jornales * jornal,
  plus,
  descuento,
  neto: jornales * jornal + plus - descuento,
  nota: '',
});

test('la semana de pago va de sábado a viernes', () => {
  assert.deepEqual(semanaDePago('2026-10-02'), { desde: '2026-09-26', hasta: '2026-10-02' }); // viernes
  assert.deepEqual(semanaDePago('2026-10-03'), { desde: '2026-10-03', hasta: '2026-10-09' }); // sábado
  assert.deepEqual(semanaDePago('2026-09-30'), { desde: '2026-09-26', hasta: '2026-10-02' }); // miércoles
});

test('liquidar: el descuento no supera la deuda ni lo que cobra', () => {
  assert.deepEqual(liquidar({ jornales: 5, jornal: 40000, deuda: 50000 }), { bruto: 200000, plus: 0, tope: 50000, descuento: 50000, neto: 150000 });
  assert.equal(liquidar({ jornales: 1, jornal: 40000, deuda: 90000 }).descuento, 40000);
  assert.equal(liquidar({ jornales: 1, jornal: 40000, deuda: 90000, plus: 10000 }).descuento, 50000);
  assert.equal(liquidar({ jornales: 2, jornal: 40000, deuda: 90000, descuento: 0 }).neto, 80000);
});

test('los adelantos se descuentan del más viejo al más nuevo', () => {
  const lista = [
    { id: 'b', monto: 20000, creado: 2 },
    { id: 'a', monto: 30000, creado: 1 },
  ];
  const e = estadoAdelantos(lista, 40000);
  assert.deepEqual(e.get('a'), { descontado: 30000, pendiente: 0 });
  assert.deepEqual(e.get('b'), { descontado: 10000, pendiente: 10000 });
});

test('asistencia: ½, 1½ y doble jornada; lo que lleva y le queda', () => {
  const { t, juan } = base();
  const t2 = correr(
    t,
    ['asistencia.marcar', { obrero_id: juan, fecha: '2026-09-28', jornales: 1 }],
    ['asistencia.marcar', { obrero_id: juan, fecha: '2026-09-29', jornales: 1.5 }],
    ['asistencia.marcar', { obrero_id: juan, fecha: '2026-09-30', jornales: 2, nota: 'hormigonado' }],
    ['asistencia.marcar', { obrero_id: juan, fecha: '2026-10-01', jornales: 0.5 }],
    ['adelanto.crear', { id: nuevoId(), obrero_id: juan, monto: 30000, fecha: '2026-09-29' }]
  );
  const c = cuentas(t2).get(juan);
  assert.equal(c.pend_dias, 4);
  assert.equal(c.pend_jornales, 5);
  assert.equal(c.deuda, 30000);
  assert.equal(t2.asistencias.get(`${juan}|2026-09-30`).nota, 'hormigonado');
  assert.throws(() => correr(t2, ['asistencia.marcar', { obrero_id: juan, fecha: '2026-10-01', jornales: 3 }]), Rechazo);
});

test('pagar bloquea los días y descuenta; anular el pago los libera', () => {
  const { t, juan, pedro } = base();
  const adelanto = nuevoId();
  let t2 = correr(
    t,
    ['asistencia.lote', { fecha: '2026-09-28', items: [{ obrero_id: juan, jornales: 1 }, { obrero_id: pedro, jornales: 1 }] }],
    ['asistencia.marcar', { obrero_id: juan, fecha: '2026-09-29', jornales: 1 }],
    ['adelanto.crear', { id: adelanto, obrero_id: juan, monto: 30000, fecha: '2026-09-29' }]
  );
  const p = previewPago(t2, '2026-10-02');
  assert.equal(p.items.length, 2);
  const j = p.items.find((i) => i.obrero_id === juan);
  assert.equal(j.bruto, 100000);
  assert.equal(j.descuento, 30000);
  assert.equal(j.neto, 70000);

  const pago = nuevoId();
  t2 = correr(t2, ['pago.crear', { id: pago, hasta: '2026-10-02', fecha: '2026-10-02', items: [item(juan, ['2026-09-28', '2026-09-29'], 2, 50000, 30000)] }]);
  assert.equal(t2.asistencias.get(`${juan}|2026-09-28`).pago_id, pago);
  assert.equal(cuentas(t2).get(juan).deuda, 0);
  assert.throws(() => correr(t2, ['asistencia.marcar', { obrero_id: juan, fecha: '2026-09-28', jornales: 0 }]), /ya está pagado/);
  // El lote saltea los días pagados en vez de fallar.
  const t3 = correr(t2, ['asistencia.lote', { fecha: '2026-09-28', items: [{ obrero_id: juan, jornales: 0 }, { obrero_id: pedro, jornales: 0 }] }]);
  assert.equal(t3.asistencias.get(`${juan}|2026-09-28`).jornales, 1);
  assert.equal(t3.asistencias.get(`${pedro}|2026-09-28`).jornales, 0);
  // No se puede pagar dos veces el mismo día ni borrar un adelanto ya descontado.
  assert.throws(
    () => correr(t2, ['pago.crear', { id: nuevoId(), hasta: '2026-10-02', fecha: '2026-10-02', items: [item(juan, ['2026-09-28'], 1, 50000)] }]),
    /ya se pagaron/
  );
  assert.throws(() => correr(t2, ['adelanto.borrar', { id: adelanto }]), /ya se descontó/);

  const t4 = correr(t2, ['pago.anular', { id: pago }]);
  assert.equal(t4.asistencias.get(`${juan}|2026-09-28`).pago_id, null);
  assert.equal(cuentas(t4).get(juan).deuda, 30000);
  assert.equal(listaPagos(t4).length, 0);
  assert.doesNotThrow(() => correr(t4, ['adelanto.borrar', { id: adelanto }]));
});

test('el descuento no puede superar los adelantos pendientes', () => {
  const { t, juan } = base();
  const t2 = correr(t, ['asistencia.marcar', { obrero_id: juan, fecha: '2026-09-28', jornales: 1 }]);
  assert.throws(
    () => correr(t2, ['pago.crear', { id: nuevoId(), hasta: '2026-10-02', fecha: '2026-10-02', items: [item(juan, ['2026-09-28'], 1, 50000, 1000)] }]),
    /supera los adelantos/
  );
});

test('herramientas: entregar, mover, devolver y reclamar con cargo al encargado', () => {
  const { t, juan, funes, roldan, amoladora } = base();
  let t2 = correr(
    t,
    ['cuadrilla.guardar', { id: funes, nombre: 'Plaza Funes', color: 'naranja', encargado_id: juan }],
    ['herramienta.mover', { desde: null, hacia: funes, items: [{ herramienta_id: amoladora, cantidad: 3 }], fecha: '2026-09-29' }],
    ['herramienta.mover', { desde: funes, hacia: roldan, items: [{ herramienta_id: amoladora, cantidad: 1 }], fecha: '2026-09-30' }]
  );
  assert.equal(t2.stock.get(`${amoladora}|${funes}`).cantidad, 2);
  assert.equal(t2.stock.get(`${amoladora}|${roldan}`).cantidad, 1);
  assert.throws(
    () => correr(t2, ['herramienta.mover', { desde: null, hacia: funes, items: [{ herramienta_id: amoladora, cantidad: 2 }], fecha: '2026-09-30' }]),
    /No alcanza/
  );
  const cargo = nuevoId();
  t2 = correr(t2, [
    'herramienta.reclamo',
    { herramienta_id: amoladora, cuadrilla_id: funes, tipo: 'rotura', cantidad: 1, fecha: '2026-10-01', cargo: { adelanto_id: cargo, obrero_id: juan, monto: 25000 } },
  ]);
  assert.equal(t2.herramientas.get(amoladora).cantidad, 3);
  assert.equal(t2.stock.get(`${amoladora}|${funes}`).cantidad, 1);
  assert.equal(t2.adelantos.get(cargo).tipo, 'cargo');
  assert.equal(cuentas(t2).get(juan).deuda, 25000);
  const movs = movimientosDe(t2, { cuadrillaId: funes });
  assert.equal(movs[0].tipo, 'rotura');
  assert.equal(movs[0].responsable_nombre, 'Juan');
  assert.equal(movs[0].desde_nombre, 'Plaza Funes');
  assert.throws(() => correr(t2, ['herramienta.cantidad', { id: amoladora, delta: -2, fecha: '2026-10-01' }]), /en obras/);
  assert.throws(() => correr(t2, ['herramienta.borrar', { id: amoladora }]), /Devolvelas/);
});

test('cerrar una cuadrilla devuelve las herramientas y libera a la gente', () => {
  const { t, juan, pedro, funes, amoladora } = base();
  let t2 = correr(
    t,
    ['cuadrilla.guardar', { id: funes, nombre: 'Plaza Funes', color: 'naranja', encargado_id: pedro }],
    ['herramienta.mover', { desde: null, hacia: funes, items: [{ herramienta_id: amoladora, cantidad: 2 }], fecha: '2026-09-29' }]
  );
  t2 = correr(t2, ['cuadrilla.cerrar', { id: funes, fecha: '2026-10-02' }]);
  assert.equal(t2.cuadrillas.get(funes).activa, false);
  assert.equal(t2.stock.get(`${amoladora}|${funes}`).cantidad, 0);
  assert.equal(t2.obreros.get(juan).cuadrilla_id, null);
  assert.equal(movimientosDe(t2, { herramientaId: amoladora })[0].tipo, 'devolucion');
  assert.throws(() => correr(t2, ['cuadrilla.guardar', { id: funes, nombre: 'Otra', color: 'azul' }]), /ya se cerró/);
});

test('el encargado tiene que ser de la cuadrilla: si no está, se lo suma', () => {
  const { t, juan, funes, roldan } = base();
  const t2 = correr(t, ['cuadrilla.guardar', { id: roldan, nombre: 'Roldán', color: 'azul', encargado_id: juan }]);
  assert.equal(t2.obreros.get(juan).cuadrilla_id, roldan);
  assert.equal(t2.cuadrillas.get(roldan).encargado_id, juan);
  // Sacarlo de los integrantes le quita el cargo.
  const t3 = correr(t2, ['cuadrilla.integrantes', { id: roldan, obrero_ids: [] }]);
  assert.equal(t3.cuadrillas.get(roldan).encargado_id, null);
  assert.equal(t3.obreros.get(juan).cuadrilla_id, null);
  assert.equal(t3.cuadrillas.get(funes).encargado_id, null);
});

test('la vista reusa lo que no cambió', () => {
  const { t, juan, pedro } = base();
  const vista = crearVista();
  const v1 = vista(t);
  const v2 = vista(correr(t, ['asistencia.marcar', { obrero_id: juan, fecha: '2026-09-28', jornales: 1 }]));
  assert.equal(v2.cuadrillas, v1.cuadrillas);
  assert.equal(v2.herramientas, v1.herramientas);
  assert.notEqual(v2.obreros, v1.obreros);
  assert.equal(
    v2.obreros.find((o) => o.id === pedro),
    v1.obreros.find((o) => o.id === pedro)
  );
  assert.equal(v2.obreros.find((o) => o.id === juan).pend_jornales, 1);
  assert.equal(v2.asistencia['2026-09-28'][juan].jornales, 1);
});

test('ficha y detalle de pago salen de las tablas locales', () => {
  const { t, juan } = base();
  const pago = nuevoId();
  const t2 = correr(
    t,
    ['asistencia.marcar', { obrero_id: juan, fecha: '2026-09-28', jornales: 1.5 }],
    ['adelanto.crear', { id: nuevoId(), obrero_id: juan, monto: 10000, fecha: '2026-09-28' }],
    ['adelanto.crear', { id: nuevoId(), obrero_id: juan, monto: 50000, fecha: '2026-09-29' }],
    ['pago.crear', { id: pago, hasta: '2026-10-02', fecha: '2026-10-02', items: [item(juan, ['2026-09-28'], 1.5, 50000, 20000, 5000)] }]
  );
  const c = cuentaObrero(t2, juan);
  assert.equal(c.asistencias[0].pagado, true);
  assert.deepEqual(
    c.adelantos.map((a) => [a.monto, a.descontado, a.pendiente]),
    [
      [50000, 10000, 40000],
      [10000, 10000, 0],
    ]
  );
  assert.equal(c.pagos[0].neto, 60000);
  const d = detallePago(t2, pago);
  assert.equal(d.total_neto, 60000);
  assert.equal(d.items[0].nombre, 'Juan');
  assert.deepEqual(d.items[0].asistencias, [{ fecha: '2026-09-28', jornales: 1.5 }]);
});
