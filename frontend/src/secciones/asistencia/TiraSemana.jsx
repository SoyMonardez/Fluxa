// Días de la semana de pago (sábado → viernes). En la vista semanal hace de
// encabezado de columnas de la grilla.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { corta, inicial, numeroDia } from '../../lib/fechas';
import { COLUMNAS_SEMANA } from './grilla';

const presentesDe = (dia, activos) => (dia ? activos.filter((o) => dia[o.id]?.jornales > 0).length : 0);

export default function TiraSemana({ vista, dias, fecha, hoy, semana, asistencia, activos, onElegir, onSemana }) {
  const flecha = 'grid h-9 w-8 shrink-0 place-items-center rounded-lg text-tinta-2 active:bg-superficie-2 disabled:opacity-25';
  const anterior = (
    <button type="button" aria-label="Semana anterior" className={flecha} onClick={() => onSemana(-1)}>
      <ChevronLeft size={20} />
    </button>
  );
  const siguiente = (
    <button type="button" aria-label="Semana siguiente" className={flecha} disabled={semana.hasta >= hoy} onClick={() => onSemana(1)}>
      <ChevronRight size={20} />
    </button>
  );

  if (vista === 'semana') {
    const flechita = 'grid h-9 w-6 shrink-0 place-items-center rounded-lg text-tinta-2 active:bg-superficie-2 disabled:opacity-25';
    return (
      <div className={`${COLUMNAS_SEMANA} mt-2 items-center pr-[7px] pl-px`}>
        <div className="flex items-center">
          <button type="button" aria-label="Semana anterior" className={flechita} onClick={() => onSemana(-1)}>
            <ChevronLeft size={19} />
          </button>
          <div className="min-w-0 flex-1 text-center leading-tight">
            <p className="text-[11px] font-semibold text-tinta-3">Semana</p>
            <p className="num text-[12.5px] font-bold whitespace-nowrap">
              {corta(semana.desde)}–{corta(semana.hasta)}
            </p>
          </div>
          <button type="button" aria-label="Semana siguiente" className={flechita} disabled={semana.hasta >= hoy} onClick={() => onSemana(1)}>
            <ChevronRight size={19} />
          </button>
        </div>
        {dias.map((d) => (
          <div key={d} className={`flex flex-col items-center leading-tight ${d > hoy ? 'opacity-35' : ''}`}>
            <span className="text-[11px] font-semibold text-tinta-3">{inicial(d)}</span>
            <span className={`num text-[15px] font-bold ${d === hoy ? 'text-marca' : ''}`}>{numeroDia(d)}</span>
            <span className="num text-[10px] font-semibold text-ok">{presentesDe(asistencia[d], activos) || ''}</span>
          </div>
        ))}
      </div>
    );
  }

  const i = dias.indexOf(fecha);
  return (
    <div className="mt-2 flex items-center gap-0.5">
      {anterior}
      <div className="relative grid flex-1 grid-cols-7 gap-1">
        {/* Píldora que se desliza hasta el día elegido. */}
        {i >= 0 && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 rounded-xl bg-tinta transition-transform duration-[450ms] ease-[var(--resorte-pildora)]"
            style={{ width: 'calc((100% - 1.5rem) / 7)', transform: `translateX(calc(${i} * (100% + 0.25rem)))` }}
          />
        )}
        {dias.map((d) => {
          const futuro = d > hoy;
          const elegido = d === fecha;
          const n = presentesDe(asistencia[d], activos);
          return (
            <button
              key={d}
              type="button"
              disabled={futuro}
              onClick={() => onElegir(d)}
              aria-pressed={elegido}
              className={`relative flex flex-col items-center rounded-xl pt-1 pb-1 ${futuro ? 'opacity-30' : ''}`}
            >
              <span className={`text-[11px] font-semibold transition-colors ${elegido ? 'text-superficie/70' : 'text-tinta-3'}`}>{inicial(d)}</span>
              <span className={`num text-[17px] leading-tight font-bold transition-colors ${elegido ? 'text-superficie' : d === hoy ? 'text-marca' : ''}`}>
                {numeroDia(d)}
              </span>
              <span className={`num h-3.5 text-[10px] leading-3.5 font-bold transition-colors ${elegido ? 'text-superficie/80' : 'text-ok'}`}>{n || ''}</span>
            </button>
          );
        })}
      </div>
      {siguiente}
    </div>
  );
}
