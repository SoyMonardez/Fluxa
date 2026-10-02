// Panel que sube desde abajo (en compu, ventana centrada). Se cierra tocando
// afuera, arrastrando hacia abajo desde la manija o el título, o con "atrás".
import { useContext, useRef } from 'react';
import { X } from 'lucide-react';
import { cerrar } from '../lib/hojas';
import { EstadoHoja } from './estadoHoja';
import { useEscritorio } from './useMedia';

const DISTANCIA_CIERRE = 110; // px
const VELOCIDAD_CIERRE = 0.65; // px/ms

export default function Hoja({ titulo, subtitulo, children, pie, acciones, completo = false, cabecera, onCerrar = () => cerrar() }) {
  const { saliendo, reemplazo } = useContext(EstadoHoja);
  const escritorio = useEscritorio();
  const panel = useRef(null);
  const arrastre = useRef(null);

  function alApoyar(e) {
    if (escritorio || saliendo || e.button !== 0 || e.target.closest('button, a, input, textarea, select')) return;
    arrastre.current = { y0: e.clientY, y: 0, v: 0, t: e.timeStamp, ultimoY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    panel.current.style.transition = 'none';
  }

  function alMover(e) {
    const a = arrastre.current;
    if (!a) return;
    const dy = e.clientY - a.y0;
    a.y = dy > 0 ? dy : dy * 0.05; // hacia arriba casi no se mueve
    const dt = e.timeStamp - a.t;
    if (dt > 0) a.v = (e.clientY - a.ultimoY) / dt;
    a.t = e.timeStamp;
    a.ultimoY = e.clientY;
    panel.current.style.transform = `translateY(${a.y}px)`;
  }

  function alSoltar() {
    const a = arrastre.current;
    if (!a) return;
    arrastre.current = null;
    const p = panel.current;
    if (a.y > DISTANCIA_CIERRE || (a.y > 20 && a.v > VELOCIDAD_CIERRE)) {
      // Sigue bajando desde donde quedó el dedo.
      p.dataset.soltada = '';
      p.style.transition = 'transform 0.22s cubic-bezier(0.4, 0, 1, 1)';
      p.style.transform = 'translateY(100%)';
      onCerrar();
    } else {
      p.style.transition = 'transform 0.4s var(--resorte)';
      p.style.transform = '';
    }
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6 ${saliendo ? 'hoja-saliendo' : ''}`}>
      <div className="hoja-fondo absolute inset-0 bg-black/45" onClick={saliendo ? undefined : onCerrar} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={typeof titulo === 'string' ? titulo : undefined}
        data-reemplazo={reemplazo ? '' : undefined}
        className={`hoja-panel relative flex max-h-[calc(100dvh-0.75rem)] w-full flex-col rounded-t-[1.75rem] bg-superficie shadow-[var(--sombra-alta)] md:max-h-[min(860px,calc(100dvh-3rem))] md:max-w-lg md:rounded-[1.75rem] ${
          completo ? 'h-[calc(100dvh-0.75rem)] md:h-[min(860px,calc(100dvh-3rem))]' : ''
        }`}
      >
        <div className="shrink-0 touch-none" onPointerDown={alApoyar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}>
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
      </div>
    </div>
  );
}

export function BotonCerrar({ onClick = () => cerrar(), className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Cerrar"
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-superficie-2 text-tinta-2 transition-transform active:scale-90 ${className}`}
    >
      <X size={18} strokeWidth={2.4} />
    </button>
  );
}
