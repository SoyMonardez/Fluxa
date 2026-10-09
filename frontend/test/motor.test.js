import assert from 'node:assert/strict';
import { test } from 'node:test';
import { almacenMemoria } from '../src/motor/almacen.js';
import { crearMotor } from '../src/motor/motor.js';
import { Rechazo } from '../src/motor/reducir.js';
import { nuevoId } from '../src/motor/uuid.js';
import { servidorFalso } from './servidor.js';

const HOY = '2026-10-02'; // viernes
const tick = () => new Promise((r) => setImmediate(r));

/** Un celular: motor + almacén + conexión propia. Los reintentos automáticos no corren solos. */
function celular(srv, { almacen = almacenMemoria(), conexion = srv.conexion() } = {}) {
  const avisos = { rechazos: [], subidos: [], vencida: 0 };
  const m = crearMotor({
    almacen,
    red: conexion,
    programar: () => 0,
    desprogramar: () => {},
    avisos: {
      rechazos: (l) => avisos.rechazos.push(...l.map((x) => x.error)),
      subidos: (n) => avisos.subidos.push(n),
      sesionVencida: () => (avisos.vencida += 1),
    },
  });
  return { m, almacen, conexion, avisos };
}

async function encendido(srv, opciones) {
  const c = celular(srv, opciones);
  await c.m.arrancar();
  await c.m.sincronizar();
  return c;
}

function obra(srv) {
  const juan = nuevoId();
  const pedro = nuevoId();
  const funes = nuevoId();
  srv.ejecutar('cuadrilla.guardar', { id: funes, nombre: 'Plaza Funes', obra: '', color: 'naranja', encargado_id: null });
  srv.ejecutar('obrero.guardar', { id: juan, nombre: 'Juan', rol: 'Oficial', jornal: 50000, cuadrilla_id: funes });
  srv.ejecutar('obrero.guardar', { id: pedro, nombre: 'Pedro', rol: 'Ayudante', jornal: 40000, cuadrilla_id: funes });
  return { juan, pedro, funes };
}

const marcar = (m, obrero_id, fecha = HOY, jornales = 1) => m.ejecutar('asistencia.marcar', { obrero_id, fecha, jornales });

function pagarTodo(m, obreroId, jornal) {
  const t = m.tablas();
  const fechas = [...t.asistencias.values()].filter((a) => a.obrero_id === obreroId && a.jornales > 0 && !a.pago_id).map((a) => a.fecha);
  const jornales = fechas.reduce((s, f) => s + t.asistencias.get(`${obreroId}|${f}`).jornales, 0);
  const bruto = jornales * jornal;
  return m.ejecutar('pago.crear', {
    id: nuevoId(),
    hasta: HOY,
    fecha: HOY,
    nota: '',
    items: [{ id: nuevoId(), obrero_id: obreroId, fechas, jornales, jornal, bruto, plus: 0, descuento: 0, neto: bruto, nota: '' }],
  });
}

test('arranca vacío, baja la foto completa y queda listo', async () => {
  const srv = servidorFalso();
  const { juan } = obra(srv);
  const { m } = await encendido(srv);
  const e = m.estado();
  assert.equal(e.listo, true);
  assert.equal(e.red, 'ok');
  assert.equal(e.tablas.obreros.get(juan).nombre, 'Juan');
  assert.equal(e.tablas.cuadrillas.size, 1);
});

test('sin señal: el cambio se ve al instante, queda en cola y sube al volver la señal', async () => {
  const srv = servidorFalso();
  const { juan } = obra(srv);
  const { m, conexion, avisos } = await encendido(srv);

  conexion.caida = true;
  marcar(m, juan);
  assert.equal(m.tablas().asistencias.get(`${juan}|${HOY}`).jornales, 1);
  assert.equal(m.estado().pendientes, 1);
  await m.sincronizar();
  assert.equal(m.estado().red, 'sin-senal');
  assert.equal(m.estado().pendientes, 1);
  assert.equal(srv.tablas.asistencias.size, 0);

  conexion.caida = false;
  await m.sincronizar();
  assert.equal(m.estado().pendientes, 0);
  assert.equal(m.estado().red, 'ok');
  assert.equal(srv.tablas.asistencias.get(`${juan}|${HOY}`).jornales, 1);
  assert.deepEqual(avisos.subidos, [1]);
});

test('lo hecho sin señal sobrevive a cerrar la app', async () => {
  const srv = servidorFalso();
  const { juan, pedro } = obra(srv);
  const primero = await encendido(srv);
  primero.conexion.caida = true;
  marcar(primero.m, juan);
  primero.m.ejecutar('adelanto.crear', { id: nuevoId(), obrero_id: pedro, monto: 20000, fecha: HOY, nota: '' });
  await tick();

  // Se cierra la app y se vuelve a abrir, todavía sin señal.
  const conexion = srv.conexion();
  conexion.caida = true;
  const segundo = celular(srv, { almacen: primero.almacen, conexion });
  await segundo.m.arrancar();
  await tick(); // termina el primer intento de subida (falla: sin señal)
  assert.equal(segundo.m.estado().red, 'sin-senal');
  assert.equal(segundo.m.estado().pendientes, 2);
  assert.equal(segundo.m.estado().listo, true);
  assert.equal(segundo.m.tablas().asistencias.get(`${juan}|${HOY}`).jornales, 1);
  assert.equal(segundo.m.tablas().adelantos.size, 1);

  conexion.caida = false;
  await segundo.m.sincronizar();
  assert.equal(segundo.m.estado().pendientes, 0);
  assert.equal(srv.tablas.adelantos.size, 1);
  assert.equal(srv.tablas.asistencias.size, 1);
});

test('dos pestañas abiertas a la vez no se pisan la cola guardada', async () => {
  const srv = servidorFalso();
  const { juan, pedro } = obra(srv);
  const almacen = almacenMemoria();
  const a = await encendido(srv, { almacen });
  const b = await encendido(srv, { almacen });
  a.conexion.caida = true;
  b.conexion.caida = true;
  marcar(a.m, juan);
  marcar(b.m, pedro);
  await tick();
  assert.equal((await almacen.leerTodo()).ops.length, 2);

  // Se cierran las dos sin señal; al abrir de nuevo están los dos cambios y suben.
  const c = celular(srv, { almacen });
  await c.m.arrancar();
  await c.m.sincronizar();
  assert.equal(c.m.estado().pendientes, 0);
  assert.equal(srv.tablas.asistencias.size, 2);
});

test('lo hecho en otro celular aparece y los cambios propios se reaplican encima', async () => {
  const srv = servidorFalso();
  const { juan } = obra(srv);
  const a = await encendido(srv);
  const b = await encendido(srv);

  a.conexion.caida = true;
  marcar(a.m, juan);
  b.m.ejecutar('adelanto.crear', { id: nuevoId(), obrero_id: juan, monto: 30000, fecha: HOY, nota: '' });
  await b.m.sincronizar();

  await a.m.sincronizar(); // sigue sin señal
  assert.equal(a.m.tablas().adelantos.size, 0);
  a.conexion.caida = false;
  await a.m.sincronizar();
  assert.equal(a.m.tablas().adelantos.size, 1);
  assert.equal(a.m.tablas().asistencias.get(`${juan}|${HOY}`).jornales, 1);
  assert.equal(a.m.estado().pendientes, 0);

  await b.m.sincronizar();
  assert.equal(b.m.tablas().asistencias.get(`${juan}|${HOY}`).jornales, 1);
});

test('dos celulares pagan los mismos días sin señal: el segundo se rechaza y se avisa', async () => {
  const srv = servidorFalso();
  const { juan } = obra(srv);
  srv.ejecutar('asistencia.marcar', { obrero_id: juan, fecha: HOY, jornales: 1 });
  const a = await encendido(srv);
  const b = await encendido(srv);
  a.conexion.caida = true;
  b.conexion.caida = true;

  const pagoA = pagarTodo(a.m, juan, 50000);
  const pagoB = pagarTodo(b.m, juan, 50000);
  assert.equal(b.m.tablas().asistencias.get(`${juan}|${HOY}`).pago_id, pagoB.datos.id);

  a.conexion.caida = false;
  await a.m.sincronizar();
  b.conexion.caida = false;
  await b.m.sincronizar();

  assert.equal(b.avisos.rechazos.length, 1);
  assert.match(b.avisos.rechazos[0], /ya se pagaron/);
  assert.equal(b.m.estado().pendientes, 0);
  assert.equal(b.m.tablas().pagos.size, 1);
  assert.equal(b.m.tablas().asistencias.get(`${juan}|${HOY}`).pago_id, pagoA.datos.id);
});

test('si se pierde la respuesta, reintentar no duplica', async () => {
  const srv = servidorFalso();
  const { juan } = obra(srv);
  const { m, conexion } = await encendido(srv);

  conexion.perderRespuesta = true;
  m.ejecutar('adelanto.crear', { id: nuevoId(), obrero_id: juan, monto: 10000, fecha: HOY, nota: '' });
  await m.sincronizar();
  assert.equal(m.estado().pendientes, 1);
  assert.equal(srv.tablas.adelantos.size, 1); // el servidor ya lo tiene

  conexion.perderRespuesta = false;
  await m.sincronizar();
  assert.equal(m.estado().pendientes, 0);
  assert.equal(srv.tablas.adelantos.size, 1);
  assert.equal(m.tablas().adelantos.size, 1);
});

test('sesión vencida: se frena, conserva la cola y sigue al volver a entrar', async () => {
  const srv = servidorFalso();
  const { juan } = obra(srv);
  const { m, conexion, avisos } = await encendido(srv);

  conexion.vencida = true;
  marcar(m, juan);
  await m.sincronizar();
  assert.equal(avisos.vencida, 1);
  assert.equal(m.estado().red, 'sesion');
  assert.equal(m.estado().pendientes, 1);
  await m.sincronizar(); // frenado: no insiste
  assert.equal(avisos.vencida, 1);

  conexion.vencida = false;
  await m.reanudar();
  assert.equal(m.estado().pendientes, 0);
  assert.equal(srv.tablas.asistencias.size, 1);
});

test('muchos cambios suben en tandas de 100', async () => {
  const srv = servidorFalso();
  const { juan } = obra(srv);
  const { m, conexion } = await encendido(srv);
  conexion.caida = true;
  for (let i = 0; i < 250; i += 1) m.ejecutar('adelanto.crear', { id: nuevoId(), obrero_id: juan, monto: 100, fecha: HOY, nota: '' });
  conexion.caida = false;
  const antes = srv.pedidos;
  await m.sincronizar();
  assert.equal(m.estado().pendientes, 0);
  assert.equal(srv.pedidos - antes, 3);
  assert.equal(srv.tablas.adelantos.size, 250);
  assert.equal(m.tablas().adelantos.size, 250);
});

test('si un cambio de un grupo no vale, no se aplica ninguno', async () => {
  const srv = servidorFalso();
  const { juan } = obra(srv);
  const { m } = await encendido(srv);
  const antes = m.tablas();
  assert.throws(
    () =>
      m.ejecutarVarias([
        ['asistencia.marcar', { obrero_id: juan, fecha: HOY, jornales: 1 }],
        ['asistencia.marcar', { obrero_id: nuevoId(), fecha: HOY, jornales: 1 }],
      ]),
    Rechazo
  );
  assert.equal(m.tablas(), antes);
  assert.equal(m.estado().pendientes, 0);
});

test('un pago pendiente pasa a confirmado sólo cuando lo acepta el servidor', async () => {
  const srv = servidorFalso();
  const { juan } = obra(srv);
  const { m, conexion } = await encendido(srv);
  marcar(m, juan);
  await m.sincronizar();
  conexion.caida = true;
  const pago = pagarTodo(m, juan, 50000).datos.id;
  assert.equal(m.estado().pagosConfirmados.has(pago), false);
  await m.sincronizar();
  assert.equal(m.estado().pagosConfirmados.has(pago), false);
  conexion.caida = false;
  await m.sincronizar();
  assert.equal(m.estado().pagosConfirmados.has(pago), true);
});

test('los ids provisorios de movimientos se reemplazan por los del servidor', async () => {
  const srv = servidorFalso();
  const { funes } = obra(srv);
  const { m } = await encendido(srv);
  const h = nuevoId();
  m.ejecutar('herramienta.crear', { id: h, nombre: 'Amoladora', tipo: 'herramienta', cantidad: 3, valor: 0, nota: '', cuadrilla_id: funes, fecha: HOY });
  assert.equal(m.tablas().movimientos.size, 2);
  assert.equal(m.tablas().stock.get(`${h}|${funes}`).cantidad, 3);
  await m.sincronizar();
  assert.equal(m.tablas().movimientos.size, 2);
  assert.equal(m.tablas().stock.get(`${h}|${funes}`).cantidad, 3);
});

test('cerrar sesión borra lo guardado y empieza de cero', async () => {
  const srv = servidorFalso();
  const { juan } = obra(srv);
  const { m, almacen, conexion } = await encendido(srv);
  conexion.caida = true;
  marcar(m, juan);
  await m.reiniciar();
  assert.equal(m.estado().pendientes, 0);
  assert.equal(m.estado().listo, false);
  assert.equal(m.tablas().obreros.size, 0);
  const guardado = await almacen.leerTodo();
  assert.deepEqual(guardado.ops, []);
  assert.deepEqual(guardado.datos, {});

  conexion.caida = false;
  await m.reanudar();
  assert.equal(m.estado().listo, true);
  assert.equal(m.tablas().obreros.size, 2);
  assert.equal(srv.tablas.asistencias.size, 0); // lo que no se subió se perdió (se avisa antes de salir)
});

test('si falla el guardado de la respuesta no descarta la cola ni adelanta el cursor', async () => {
  const srv = servidorFalso();
  const { juan } = obra(srv);
  const almacen = almacenMemoria();
  const guardar = almacen.guardarSync;
  const { m } = await encendido(srv, { almacen });
  marcar(m, juan);
  await tick();
  almacen.guardarSync = async () => { throw new Error('Disco lleno'); };
  await m.sincronizar();
  assert.equal(m.estado().pendientes, 1);
  assert.equal(m.estado().red, 'error');
  almacen.guardarSync = guardar;
  await m.sincronizar();
  assert.equal(m.estado().pendientes, 0);
  assert.equal(srv.tablas.asistencias.size, 1);
  const reinicio = await encendido(srv, { almacen });
  assert.equal(reinicio.m.tablas().asistencias.get(`${juan}|${HOY}`).jornales, 1);
});

test('una pestaña con respuesta atrasada no borra tablas ya sincronizadas por otra', async () => {
  const srv = servidorFalso();
  const { juan } = obra(srv);
  const almacen = almacenMemoria();
  const a = await encendido(srv, { almacen });
  const b = await encendido(srv, { almacen });
  let soltar;
  a.conexion.sincronizar = async (pedido) => {
    const respuesta = await srv.sincronizar(pedido);
    await new Promise((resolve) => { soltar = resolve; });
    return respuesta;
  };
  a.m.ejecutar('obrero.guardar', { id: juan, nombre: 'Juan anterior', rol: 'Oficial', jornal: 50000 });
  const enVuelo = a.m.sincronizar();
  await tick();
  b.m.ejecutar('obrero.guardar', { id: juan, nombre: 'Juan', rol: 'Oficial', jornal: 60000 });
  await b.m.sincronizar();
  soltar();
  await enVuelo;
  await b.m.sincronizar();
  const guardado = await almacen.leerTodo();
  assert.equal(guardado.datos['t.obreros'].get(juan).jornal, 60000);
});

test('si no se guarda una operación avisa, bloquea más cambios y reintenta sin perderla', async () => {
  const srv = servidorFalso();
  const { juan } = obra(srv);
  const almacen = almacenMemoria();
  const agregar = almacen.agregarOps;
  const { m } = await encendido(srv, { almacen });
  almacen.agregarOps = async () => { throw new Error('Sin espacio'); };
  marcar(m, juan);
  await tick();
  assert.match(m.estado().errorLocal, /No se pudo guardar/);
  assert.equal(m.estado().sinGuardar, 1);
  assert.throws(() => marcar(m, juan), /No se pudo guardar/);
  await m.sincronizar();
  assert.equal(srv.tablas.asistencias.size, 0);
  almacen.agregarOps = agregar;
  await m.sincronizar();
  assert.equal(m.estado().errorLocal, null);
  assert.equal(m.estado().sinGuardar, 0);
  assert.equal(m.estado().pendientes, 0);
  assert.equal(srv.tablas.asistencias.size, 1);
});

test('un fallo al leer no pisa los datos guardados y permite reintentar', async () => {
  const srv = servidorFalso();
  obra(srv);
  const almacen = almacenMemoria();
  const leer = almacen.leerTodo;
  almacen.leerTodo = async () => { throw new Error('No disponible'); };
  const { m } = celular(srv, { almacen });
  await m.arrancar();
  assert.equal(m.estado().cargado, false);
  assert.equal(srv.pedidos, 0);
  almacen.leerTodo = leer;
  await m.sincronizar();
  await m.sincronizar();
  assert.equal(m.estado().listo, true);
  assert.equal(m.estado().errorLocal, null);
});
