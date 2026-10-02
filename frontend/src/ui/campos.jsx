// Controles chicos reutilizables.
import { useLayoutEffect, useRef } from 'react';
import { animate, m, useReducedMotion } from 'motion/react';
import { Minus, Plus, Search, X } from 'lucide-react';
import { leerMonto, miles, pesos } from '../lib/formato';

/** Monto grande con separador de miles. Abre el teclado numérico del celular. */
export function MontoInput({ valor, onCambio, autoFocus = false, tam = 'grande', placeholder = '0' }) {
  const grande = tam === 'grande';
  return (
    <label
      className={`flex items-baseline justify-center gap-1.5 rounded-2xl border border-borde bg-superficie-2 focus-within:border-marca ${
        grande ? 'px-4 py-4' : 'px-3 py-2'
      }`}
    >
      <span className={`font-semibold text-tinta-3 ${grande ? 'text-2xl' : 'text-base'}`}>$</span>
      <input
        inputMode="numeric"
        enterKeyHint="done"
        autoFocus={autoFocus}
        value={valor ? miles(valor) : ''}
        placeholder={placeholder}
        onChange={(e) => onCambio(leerMonto(e.target.value))}
        onFocus={(e) => e.target.select()}
        className={`num w-full min-w-0 bg-transparent font-bold outline-none placeholder:text-tinta-3 ${
          grande ? 'text-center text-4xl' : 'text-lg'
        }`}
      />
    </label>
  );
}

/** Número que "cuenta" hasta el valor nuevo. */
export function Numero({ valor, formato = pesos, className = '' }) {
  const ref = useRef(null);
  const previo = useRef(valor);
  const quieto = useReducedMotion();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const desde = previo.current;
    previo.current = valor;
    if (quieto || desde === valor || !el.textContent) {
      el.textContent = formato(valor);
      return undefined;
    }
    const ctrl = animate(desde, valor, {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = formato(v);
      },
    });
    return () => ctrl.stop();
  }, [valor, formato, quieto]);

  return <span ref={ref} className={`num ${className}`} />;
}

/** Control segmentado con "píldora" que se desliza. */
export function Segmentos({ id, opciones, valor, onCambio, className = '', fondo = 'bg-superficie-2', pildora = 'bg-superficie' }) {
  return (
    <div role="tablist" className={`flex rounded-[0.9rem] border border-borde p-1 ${fondo} ${className}`}>
      {opciones.map((o) => {
        const activo = valor === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="tab"
            aria-selected={activo}
            onClick={() => onCambio(o.valor)}
            className="relative flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 text-sm font-semibold"
          >
            {activo && (
              <m.span
                layoutId={`seg-${id}`}
                className={`absolute inset-0 rounded-[0.65rem] shadow-sm ${pildora}`}
                transition={{ type: 'spring', damping: 32, stiffness: 420 }}
              />
            )}
            <span className={`relative flex items-center gap-1.5 ${activo ? 'text-tinta' : 'text-tinta-2'}`}>
              {o.icono && <o.icono size={16} />}
              {o.texto}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Interruptor({ activo, onCambio, etiqueta }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={() => onCambio(!activo)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${activo ? 'bg-ok' : 'bg-borde'}`}
    >
      <m.span
        className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow"
        animate={{ x: activo ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 34 }}
      />
    </button>
  );
}

export function Contador({ valor, min = 0, max = Infinity, onCambio }) {
  const boton = 'grid h-10 w-10 place-items-center rounded-full border border-borde bg-superficie-2 active:scale-90 disabled:opacity-30';
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="Uno menos" className={boton} disabled={valor <= min} onClick={() => onCambio(valor - 1)}>
        <Minus size={18} strokeWidth={2.5} />
      </button>
      <span className="num w-10 text-center text-lg font-bold">{valor}</span>
      <button type="button" aria-label="Uno más" className={boton} disabled={valor >= max} onClick={() => onCambio(valor + 1)}>
        <Plus size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function Buscador({ valor, onCambio, placeholder = 'Buscar…', autoFocus = false }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-tinta-3" size={18} />
      <input
        type="search"
        enterKeyHint="search"
        value={valor}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onCambio(e.target.value)}
        className="campo py-2.5 pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {valor && (
        <button
          type="button"
          aria-label="Borrar búsqueda"
          onClick={() => onCambio('')}
          className="absolute top-1/2 right-1.5 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-tinta-3"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function Vacio({ icono: Icono, titulo, texto, children }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-superficie-2 text-tinta-3">
        <Icono size={30} />
      </div>
      <p className="font-semibold">{titulo}</p>
      {texto && <p className="mt-1 max-w-xs text-sm text-tinta-2">{texto}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

/** Fila "concepto ........ monto". */
export function Renglon({ texto, valor, fuerte = false, className = '' }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${fuerte ? 'font-bold' : ''} ${className}`}>
      <span className={fuerte ? '' : 'text-tinta-2'}>{texto}</span>
      <span className="num shrink-0">{valor}</span>
    </div>
  );
}
