import { memo, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { marcar, marcarVarios } from '../../lib/acciones';
import { avisar } from '../../lib/avisos';
import { cuentaRapida } from '../../lib/derivados';
import { colorDe, jornales, pesos } from '../../lib/formato';
import { abrir } from '../../lib/hojas';
import { vibrar } from '../../lib/vibrar';
import Avatar from '../../ui/Avatar';
import Tilde from '../../ui/Tilde';

/** Una cuadrilla en el día: encabezado con "Todos" y la lista de obreros. */
export default function GrupoDia({ grupo, fecha, registros }) {
  const { cuadrilla, obreros } = grupo;
  const [cascada, setCascada] = useState(false);
  const nombre = cuadrilla?.nombre ?? 'Sin cuadrilla';
  const libres = obreros.filter((o) => !registros[o.id]?.pagado);
  const marcados = obreros.filter((o) => registros[o.id]?.jornales > 0).length;
  const todos = libres.length > 0 && libres.every((o) => registros[o.id]?.jornales > 0);

  async function alternarTodos() {
    const items = todos
      ? libres.map((o) => ({ obrero_id: o.id, jornales: 0 }))
      : libres.filter((o) => !(registros[o.id]?.jornales > 0)).map((o) => ({ obrero_id: o.id, jornales: 1 }));
    if (!items.length) return;
    vibrar(14);
    setCascada(true);
    setTimeout(() => setCascada(false), 900);
    const previos = await marcarVarios(fecha, items);
    avisar(todos ? `Desmarcaste a ${nombre}` : `${items.length} presente${items.length > 1 ? 's' : ''} en ${nombre}`, {
      accion: { texto: 'Deshacer', fn: () => marcarVarios(fecha, previos) },
    });
  }

  return (
    <section className="mt-5">
      <div className="flex items-center gap-2 px-1 pb-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colorDe(cuadrilla?.color) }} />
        <h2 className="min-w-0 truncate text-[15px] font-bold">{nombre}</h2>
        <span className="num shrink-0 text-sm font-semibold text-tinta-3">
          {marcados}/{obreros.length}
        </span>
        {libres.length > 0 && (
          <button
            type="button"
            onClick={alternarTodos}
            className={`chip ml-auto h-8 shrink-0 px-3 text-[13px] active:scale-95 ${
              todos ? 'border border-borde bg-superficie text-tinta-2' : 'bg-ok-suave text-ok'
            }`}
          >
            {todos ? (
              'Quitar todos'
            ) : (
              <>
                <CheckCheck size={16} strokeWidth={2.6} /> Todos
              </>
            )}
          </button>
        )}
      </div>
      <div className="tarjeta divide-y divide-borde overflow-hidden">
        {obreros.map((o, i) => (
          <FilaAsistencia
            key={o.id}
            obrero={o}
            registro={registros[o.id]}
            fecha={fecha}
            color={cuadrilla?.color}
            encargado={cuadrilla?.encargado_id === o.id}
            retraso={cascada ? i * 0.045 : 0}
          />
        ))}
      </div>
    </section>
  );
}

const FilaAsistencia = memo(function FilaAsistencia({ obrero: o, registro, fecha, color, encargado, retraso }) {
  const { deuda, queda } = cuentaRapida(o);
  const valor = registro?.jornales ?? 0;

  return (
    <div className="flex items-center gap-3 py-2.5 pr-2.5 pl-3">
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => abrir('ficha', { obreroId: o.id })}>
        <Avatar nombre={o.nombre} color={color} encargado={encargado} />
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-tight font-semibold">{o.nombre}</p>
          <p className="mt-0.5 truncate text-[13px] text-tinta-2">
            {deuda > 0 ? (
              <>
                <span className="font-semibold text-deuda">adel. {pesos(deuda)}</span>
                {o.pend_dias > 0 && ` · ${jornales(o.pend_jornales)} j`}
              </>
            ) : o.pend_dias ? (
              `${jornales(o.pend_jornales)} j sin cobrar`
            ) : (
              o.rol
            )}
          </p>
        </div>
      </button>
      <div className="shrink-0 text-right">
        <p className={`num text-[15px] leading-tight font-bold ${queda < 0 ? 'text-mal' : queda === 0 ? 'text-tinta-3' : ''}`}>{pesos(queda)}</p>
        <p className="text-[11px] text-tinta-3">le queda</p>
      </div>
      <Tilde
        valor={valor}
        pagado={registro?.pagado}
        retraso={retraso}
        etiqueta={`Asistencia de ${o.nombre}`}
        onTocar={() => {
          vibrar();
          marcar(o.id, fecha, valor > 0 ? 0 : 1);
        }}
        onMantener={() => abrir('jornada', { obreroId: o.id, fecha })}
      />
    </div>
  );
});
