import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { almacenIDB } from '../src/motor/almacen.js';

test('IndexedDB conserva la foto más nueva y elimina sólo las operaciones confirmadas', async () => {
  await almacenIDB.borrarTodo();
  await almacenIDB.agregarOps([{ n: '001', id: 'a' }, { n: '002', id: 'b' }]);
  const reciente = new Map([['juan', { id: 'juan', jornal: 60000 }]]);
  await almacenIDB.guardarSync({ kv: { meta: { cursor: 20 }, 't.obreros': reciente }, quitar: ['002'] });
  await almacenIDB.guardarSync({ kv: { meta: { cursor: 10 }, 't.obreros': new Map() }, quitar: ['001'] });
  const guardado = await almacenIDB.leerTodo();
  assert.equal(guardado.datos.meta.cursor, 20);
  assert.deepEqual(guardado.datos['t.obreros'], reciente);
  assert.deepEqual(guardado.ops, []);
  await almacenIDB.borrarTodo();
  assert.deepEqual((await almacenIDB.leerTodo()).datos, {});
});
