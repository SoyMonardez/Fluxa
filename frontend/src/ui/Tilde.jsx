// El tilde de asistencia. Toque = presente / falta. Mantener = opciones de jornada.
import { m } from 'motion/react';
import { Lock } from 'lucide-react';
import { jornales as textoJornales } from '../lib/formato';
import { usePresionLarga } from './usePresionLarga';

export default function Tilde({ valor = 0, pagado = false, deshabilitado = false, onTocar, onMantener, tam = 46, retraso = 0, etiqueta }) {
  const gestos = usePresionLarga(onMantener, onTocar);
  const marcado = valor > 0;
  const especial = marcado && valor !== 1;
  const fondo = !marcado ? 'bg-transparent border-borde' : especial ? 'bg-info border-info' : 'bg-ok border-ok';

  return (
    <m.button
      type="button"
      {...gestos}
      disabled={deshabilitado}
      aria-pressed={marcado}
      aria-label={etiqueta}
      whileTap={{ scale: 0.86 }}
      className="sin-seleccion relative grid shrink-0 place-items-center rounded-full disabled:opacity-35"
      style={{ width: tam, height: tam }}
    >
      <m.span
        className={`absolute inset-0 rounded-full border-2 transition-colors duration-200 ${fondo} ${pagado ? 'opacity-55' : ''}`}
        style={{ transitionDelay: `${retraso}s` }}
        animate={marcado ? { scale: [0.82, 1.1, 1] } : { scale: 1 }}
        transition={{ duration: 0.32, delay: retraso, ease: 'easeOut' }}
      />
      {valor === 1 && (
        <svg viewBox="0 0 24 24" className="relative" style={{ width: tam * 0.52, height: tam * 0.52 }} aria-hidden="true">
          <m.path
            d="M4.5 12.5l4.6 4.6L19.5 6.8"
            fill="none"
            stroke="white"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.26, delay: retraso + 0.05, ease: 'easeOut' }}
          />
        </svg>
      )}
      {especial && (
        <m.span
          className="relative font-extrabold text-white"
          style={{ fontSize: tam * 0.36 }}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: retraso }}
        >
          {textoJornales(valor)}
        </m.span>
      )}
      {pagado && (
        <span className="absolute -right-0.5 -bottom-0.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-tinta text-superficie ring-2 ring-superficie">
          <Lock size={10} strokeWidth={2.8} />
        </span>
      )}
    </m.button>
  );
}
