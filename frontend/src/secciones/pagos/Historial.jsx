import { ChevronRight, Receipt } from 'lucide-react';
import { usePagos } from '../../lib/consultas';
import { conDia, corta, semanaDePago } from '../../lib/fechas';
import { jornales, pesos } from '../../lib/formato';
import { abrir } from '../../lib/hojas';
import { Vacio } from '../../ui/campos';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function Historial() {
  const pagos = usePagos();

  if (!pagos.length) return <Vacio icono={Receipt} titulo="Todavía no hay pagos" texto="Cuando confirmes el primer pago del viernes, va a aparecer acá." />;

  // Agrupados por mes
  const grupos = [];
  for (const p of pagos) {
    const [y, mm] = p.fecha.split('-').map(Number);
    const clave = `${MESES[mm - 1]} ${y}`;
    if (grupos.at(-1)?.clave !== clave) grupos.push({ clave, pagos: [], total: 0 });
    grupos.at(-1).pagos.push(p);
    grupos.at(-1).total += p.total_neto;
  }

  return (
    <div className="animar-subir pb-6">
      {grupos.map((g) => (
        <section key={g.clave}>
          <div className="flex items-baseline justify-between px-1 pt-5 pb-2">
            <h2 className="text-[13px] font-bold tracking-wide text-tinta-2 uppercase">{g.clave}</h2>
            <span className="num text-sm font-semibold text-tinta-3">{pesos(g.total)}</span>
          </div>
          <ul className="tarjeta divide-y divide-borde overflow-hidden">
            {g.pagos.map((p) => {
              const s = semanaDePago(p.hasta);
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => abrir('detallePago', { pagoId: p.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-superficie-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold capitalize">{conDia(p.fecha)}</p>
                      <p className="num truncate text-[13px] text-tinta-3">
                        Semana {corta(s.desde)}–{corta(s.hasta)} · {p.obreros} obreros · {jornales(p.jornales)} j
                      </p>
                    </div>
                    <span className="num font-bold">{pesos(p.total_neto)}</span>
                    <ChevronRight size={18} className="text-tinta-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
