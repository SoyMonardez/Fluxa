// Panel que sube desde abajo (en compu, ventana centrada). Se cierra tocando
// afuera, arrastrando hacia abajo desde la manija o con "atrás".
import { m, useDragControls } from 'motion/react';
import { X } from 'lucide-react';
import { cerrar } from '../lib/hojas';
import { useEscritorio } from './useMedia';

const RESORTE = { type: 'spring', damping: 34, stiffness: 380, mass: 0.9 };

export default function Hoja({ titulo, subtitulo, children, pie, acciones, completo = false, cabecera, onCerrar = () => cerrar() }) {
  const controles = useDragControls();
  const escritorio = useEscritorio();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <m.div
        className="absolute inset-0 bg-black/45"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onCerrar}
      />
      <m.div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`relative flex max-h-[calc(100dvh-0.75rem)] w-full flex-col rounded-t-[1.75rem] bg-superficie shadow-[var(--sombra-alta)] md:max-h-[min(860px,calc(100dvh-3rem))] md:max-w-lg md:rounded-[1.75rem] ${
          completo ? 'h-[calc(100dvh-0.75rem)] md:h-[min(860px,calc(100dvh-3rem))]' : ''
        }`}
        initial={escritorio ? { opacity: 0, scale: 0.96, y: 16 } : { y: '100%' }}
        animate={escritorio ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
        exit={escritorio ? { opacity: 0, scale: 0.96, y: 16 } : { y: '100%' }}
        transition={RESORTE}
        drag={escritorio ? false : 'y'}
        dragControls={controles}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.9 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 650) onCerrar();
        }}
      >
        <div className="shrink-0 touch-none" onPointerDown={(e) => !escritorio && controles.start(e)}>
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-borde md:hidden" />
          {cabecera ?? (
            <header className="flex items-start gap-2 px-5 pt-3 pb-3">
              <div className="min-w-0 flex-1 pt-1">
                <h2 className="text-lg leading-tight font-bold">{titulo}</h2>
                {subtitulo && <p className="mt-0.5 text-sm text-tinta-2">{subtitulo}</p>}
              </div>
              {acciones}
              <BotonCerrar onClick={onCerrar} />
            </header>
          )}
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {pie ? (
          <div className="shrink-0 border-t border-borde px-5 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]">{pie}</div>
        ) : (
          <div className="pb-seguro shrink-0" />
        )}
      </m.div>
    </div>
  );
}

export function BotonCerrar({ onClick = () => cerrar(), className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Cerrar"
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-superficie-2 text-tinta-2 active:scale-90 ${className}`}
    >
      <X size={18} strokeWidth={2.4} />
    </button>
  );
}
