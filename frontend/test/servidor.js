// Servidor de mentira para probar el motor: mismas reglas (el reducer), con
// revisiones por fila, cursor e idempotencia como /api/sync. Cada celular usa
// su propia "conexión", que se puede cortar.
import { aplicar } from '../src/motor/reducir.js';
import { NOMBRES, vacias } from '../src/motor/tablas.js';
import { nuevoId } from '../src/motor/uuid.js';

const sinSenal = () => Object.assign(new TypeError('Failed to fetch'), { status: 0 });

export function servidorFalso() {
  let t = vacias();
  let rev = 0;
  const revs = Object.fromEntries(NOMBRES.map((n) => [n, new Map()]));
  const aplicadas = new Map();

  function aplicarOp(op) {
    if (aplicadas.has(op.id)) return { id: op.id, ...aplicadas.get(op.id) };
    let res;
    try {
      const antes = t;
      t = aplicar(t, op);
      for (const n of NOMBRES) {
        if (antes[n] === t[n]) continue;
        for (const [k, f] of t[n]) if (antes[n].get(k) !== f) revs[n].set(k, ++rev);
      }
      res = { ok: true, error: null };
    } catch (e) {
      res = { ok: false, error: e.message };
    }
    aplicadas.set(op.id, res);
    return { id: op.id, ...res };
  }

  function cambiosDesde(cursor) {
    const cambios = {};
    for (const n of NOMBRES) {
      cambios[n] = [...revs[n]].filter(([, r]) => r > cursor).map(([k, r]) => ({ ...t[n].get(k), rev: r }));
    }
    return { cursor: rev, completo: cursor === 0, cambios };
  }

  const srv = {
    pedidos: 0,
    get tablas() {
      return t;
    },
    /** Carga datos directo en el servidor (como si los hubiera hecho otro celular). */
    ejecutar(tipo, datos) {
      const r = aplicarOp({ id: nuevoId(), tipo, datos, ts: Date.now() });
      if (!r.ok) throw new Error(r.error);
    },
    async sincronizar({ cursor, ops }) {
      srv.pedidos += 1;
      const resultados = ops.map(aplicarOp);
      // Como si viajara por la red: JSON de ida y vuelta.
      return JSON.parse(JSON.stringify({ ...cambiosDesde(cursor), hoy: '2026-10-02', resultados }));
    },
    /** Conexión de un celular: se puede cortar, perder la respuesta o vencer la sesión. */
    conexion() {
      const c = {
        caida: false,
        perderRespuesta: false,
        vencida: false,
        async sincronizar(pedido) {
          if (c.caida) throw sinSenal();
          if (c.vencida) throw Object.assign(new Error('La sesión venció. Volvé a ingresar.'), { status: 401 });
          const r = await srv.sincronizar(pedido);
          if (c.perderRespuesta) throw sinSenal();
          return r;
        },
      };
      return c;
    },
  };
  return srv;
}
