// Grilla de la semana: para revisar y corregir varios días de un vistazo.
import { Fragment } from 'react';
import { marcar } from '../../lib/acciones';
import { colorDe, jornales, pesos } from '../../lib/formato';
import { abrir } from '../../lib/hojas';
import { vibrar } from '../../lib/vibrar';
import Tilde from '../../ui/Tilde';
import { COLUMNAS_SEMANA } from './grilla';

const jornalesDe = (o, dias, asistencia) => dias.reduce((s, d) => s + (asistencia[d]?.[o.id]?.jornales || 0), 0);

export default function VistaSemana({ grupos, dias, asistencia, hoy }) {
  const todos = grupos.flatMap((g) => g.obreros);
  const jornalesSemana = todos.reduce((s, o) => s + jornalesDe(o, dias, asistencia), 0);
  const plataSemana = todos.reduce((s, o) => s + jornalesDe(o, dias, asistencia) * o.jornal, 0);

  return (
    <div className="tarjeta mt-3 overflow-hidden">
      {grupos.map((g) => (
        <Fragment key={g.cuadrilla?.id ?? 'sin'}>
          <div className="flex items-center gap-2 border-b border-borde bg-superficie-2 px-3 py-1.5 text-[13px] font-bold">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorDe(g.cuadrilla?.color) }} />
            {g.cuadrilla?.nombre ?? 'Sin cuadrilla'}
          </div>
          {g.obreros.map((o) => {
            const j = jornalesDe(o, dias, asistencia);
            return (
              <div key={o.id} className={`${COLUMNAS_SEMANA} items-center border-b border-borde pr-1.5 last:border-b-0`}>
                <button type="button" onClick={() => abrir('ficha', { obreroId: o.id })} className="min-w-0 py-2 pr-1 pl-3 text-left">
                  <p className="truncate text-sm leading-tight font-semibold">{o.nombre}</p>
                  <p className="num truncate text-[11px] text-tinta-3">
                    {jornales(j)} j · {pesos(j * o.jornal)}
                  </p>
                </button>
                {dias.map((d) => {
                  const r = asistencia[d]?.[o.id];
                  const valor = r?.jornales ?? 0;
                  return (
                    <div key={d} className="grid place-items-center py-1.5">
                      <Tilde
                        tam={28}
                        valor={valor}
                        pagado={r?.pagado}
                        deshabilitado={d > hoy}
                        etiqueta={`${o.nombre}, ${d}`}
                        onTocar={() => {
                          vibrar();
                          marcar(o.id, d, valor > 0 ? 0 : 1);
                        }}
                        onMantener={() => abrir('jornada', { obreroId: o.id, fecha: d })}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </Fragment>
      ))}
      <div className="flex items-center justify-between gap-3 bg-superficie-2 px-3 py-2.5 text-sm">
        <span className="text-tinta-2">
          Semana: <b className="num text-tinta">{jornales(jornalesSemana)} jornales</b>
        </span>
        <span className="num font-bold">{pesos(plataSemana)}</span>
      </div>
    </div>
  );
}
