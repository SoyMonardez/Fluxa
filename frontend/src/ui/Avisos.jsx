import { AnimatePresence, m } from 'motion/react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { quitar, useAvisos } from '../lib/avisos';

export default function Avisos() {
  const avisos = useAvisos();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <AnimatePresence initial={false}>
        {avisos.map((a) => (
          <m.div
            key={a.id}
            layout
            initial={{ opacity: 0, y: -28, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.95 }}
            transition={{ type: 'spring', damping: 26, stiffness: 420 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.6, bottom: 0 }}
            onDragEnd={(_, info) => info.offset.y < -24 && quitar(a.id)}
            onClick={() => quitar(a.id)}
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-[#1c1917] py-3 pr-2 pl-4 text-white shadow-xl ring-1 ring-white/10"
          >
            {a.tipo === 'error' ? (
              <CircleAlert size={20} className="shrink-0 text-[#f87171]" />
            ) : (
              <CircleCheck size={20} className="shrink-0 text-[#4ade80]" />
            )}
            <p className="min-w-0 flex-1 py-1 text-[15px] leading-snug font-medium">{a.texto}</p>
            {a.accion && (
              <button
                type="button"
                className="shrink-0 rounded-xl px-3 py-2 text-[15px] font-bold text-[#fdba74] active:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  quitar(a.id);
                  a.accion.fn();
                }}
              >
                {a.accion.texto}
              </button>
            )}
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
