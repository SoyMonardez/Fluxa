import { useRef } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { quitar, useAvisos } from '../lib/avisos';

export default function Avisos() {
  const avisos = useAvisos();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      {avisos.map((a) => (
        <Aviso key={a.id} aviso={a} />
      ))}
    </div>
  );
}

/** Tocarlo o empujarlo hacia arriba lo cierra. */
function Aviso({ aviso: a }) {
  const inicio = useRef(null);
  return (
    <div
      data-saliendo={a.saliendo ? '' : undefined}
      onClick={() => quitar(a.id)}
      onPointerDown={(e) => {
        inicio.current = e.clientY;
      }}
      onPointerMove={(e) => {
        if (inicio.current != null && inicio.current - e.clientY > 24) {
          inicio.current = null;
          quitar(a.id);
        }
      }}
      onPointerUp={() => {
        inicio.current = null;
      }}
      className="aviso pointer-events-auto flex w-full max-w-md touch-none items-center gap-3 rounded-2xl bg-[#1c1917] py-3 pr-2 pl-4 text-white shadow-xl ring-1 ring-white/10"
    >
      {a.tipo === 'error' ? <CircleAlert size={20} className="shrink-0 text-[#f87171]" /> : <CircleCheck size={20} className="shrink-0 text-[#4ade80]" />}
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
    </div>
  );
}
