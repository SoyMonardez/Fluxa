import { KeyRound } from 'lucide-react';
import { colorDe, iniciales } from '../lib/formato';

/** Iniciales con el color de la cuadrilla. La llave marca al encargado. */
export default function Avatar({ nombre, color, tam = 40, encargado = false, apagado = false }) {
  const c = color ? colorDe(color) : null;
  return (
    <div
      className={`relative grid shrink-0 place-items-center rounded-full font-bold ${apagado ? 'opacity-50' : ''}`}
      style={{
        width: tam,
        height: tam,
        fontSize: Math.round(tam * 0.36),
        background: c ? `color-mix(in oklab, ${c} 20%, var(--superficie))` : 'var(--superficie-2)',
        color: c ? `color-mix(in oklab, ${c} 70%, var(--tinta))` : 'var(--tinta-2)',
      }}
      aria-hidden="true"
    >
      {iniciales(nombre)}
      {encargado && (
        <span className="absolute -right-1 -bottom-1 grid h-[18px] w-[18px] place-items-center rounded-full bg-marca text-white ring-2 ring-superficie">
          <KeyRound size={10} strokeWidth={2.8} />
        </span>
      )}
    </div>
  );
}
