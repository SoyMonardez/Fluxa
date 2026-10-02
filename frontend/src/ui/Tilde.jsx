// El tilde de asistencia. Toque = presente / falta. Mantener = opciones de jornada.
import { Lock } from 'lucide-react';
import { jornales as textoJornales } from '../lib/formato';
import { usePresionLarga } from './usePresionLarga';

export default function Tilde({ valor = 0, pagado = false, deshabilitado = false, onTocar, onMantener, tam = 46, retraso = 0, etiqueta }) {
  const gestos = usePresionLarga(onMantener, onTocar);
  const marcado = valor > 0;
  const especial = marcado && valor !== 1;
  const fondo = !marcado ? 'border-borde' : especial ? 'border-info bg-info' : 'border-ok bg-ok';
  const demora = { animationDelay: `${retraso}s` };

  return (
    <button
      type="button"
      {...gestos}
      disabled={deshabilitado}
      aria-pressed={marcado}
      aria-label={etiqueta}
      className="sin-seleccion relative grid shrink-0 place-items-center rounded-full transition-transform duration-150 active:scale-[0.86] disabled:opacity-35"
      style={{ width: tam, height: tam }}
    >
      {/* La key hace que el círculo "salte" cada vez que se marca. */}
      <span
        key={marcado ? 'si' : 'no'}
        className={`absolute inset-0 rounded-full border-2 transition-colors duration-200 ${fondo} ${pagado ? 'opacity-55' : ''} ${marcado ? 'animar-marcar' : ''}`}
        style={marcado ? demora : undefined}
      />
      {valor === 1 && (
        <svg viewBox="0 0 24 24" className="relative" style={{ width: tam * 0.52, height: tam * 0.52 }} aria-hidden="true">
          <path
            d="M4.5 12.5l4.6 4.6L19.5 6.8"
            pathLength={1}
            className="animar-trazo"
            style={{ animationDelay: `${retraso + 0.05}s` }}
            fill="none"
            stroke="white"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {especial && (
        <span key={valor} className="animar-crecer relative font-extrabold text-white" style={{ fontSize: tam * 0.36, ...demora }}>
          {textoJornales(valor)}
        </span>
      )}
      {pagado && (
        <span className="absolute -right-0.5 -bottom-0.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-tinta text-superficie ring-2 ring-superficie">
          <Lock size={10} strokeWidth={2.8} />
        </span>
      )}
    </button>
  );
}
