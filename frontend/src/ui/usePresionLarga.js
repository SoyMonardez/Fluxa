import { useRef } from 'react';
import { vibrar } from '../lib/vibrar';

/** Toque corto → alTocar. Mantener apretado → alMantener (con vibración). */
export function usePresionLarga(alMantener, alTocar, ms = 420) {
  const timer = useRef(null);
  const disparado = useRef(false);
  const inicio = useRef(null);

  const cancelar = () => {
    clearTimeout(timer.current);
    inicio.current = null;
  };

  return {
    onPointerDown(e) {
      if (e.button !== 0) return;
      disparado.current = false;
      inicio.current = { x: e.clientX, y: e.clientY };
      clearTimeout(timer.current);
      if (alMantener) {
        timer.current = setTimeout(() => {
          disparado.current = true;
          vibrar(20);
          alMantener();
        }, ms);
      }
    },
    onPointerMove(e) {
      const i = inicio.current;
      if (i && (Math.abs(e.clientX - i.x) > 10 || Math.abs(e.clientY - i.y) > 10)) cancelar();
    },
    onPointerUp: cancelar,
    onPointerLeave: cancelar,
    onPointerCancel: cancelar,
    onClick(e) {
      if (disparado.current) {
        disparado.current = false;
        e.preventDefault();
        return;
      }
      alTocar?.(e);
    },
    onContextMenu: (e) => e.preventDefault(),
  };
}
