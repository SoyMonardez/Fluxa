// Piezas de página: encabezado fijo, botón flotante, esqueleto de carga y logo.
import { useEffect, useState } from 'react';
import { m } from 'motion/react';

export function Encabezado({ titulo, subtitulo, derecha, children }) {
  return (
    <header className="pt-seguro sticky top-0 z-30 border-b border-borde/70 bg-fondo/92 backdrop-blur-xl">
      <div className="mx-auto max-w-3xl px-4 pt-3 pb-2.5">
        <div className="flex min-h-11 items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.55rem] leading-tight font-extrabold tracking-tight">{titulo}</h1>
            {subtitulo && <p className="truncate text-sm text-tinta-2">{subtitulo}</p>}
          </div>
          {derecha}
        </div>
        {children}
      </div>
    </header>
  );
}

export function BotonIcono({ icono: Icono, etiqueta, onClick, activo = false, className = '', children }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={onClick}
      className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors active:scale-90 ${
        activo ? 'bg-tinta text-superficie' : 'text-tinta-2 hover:bg-superficie-2'
      } ${className}`}
    >
      <Icono size={21} />
      {children}
    </button>
  );
}

/** Se esconde mientras bajás por la lista (para no tapar los tildes) y vuelve al subir o al parar. */
function useOcultoAlBajar() {
  const [oculto, setOculto] = useState(false);
  useEffect(() => {
    let ultimo = window.scrollY;
    let timer;
    const alScroll = () => {
      const y = window.scrollY;
      if (y - ultimo > 6 && y > 80) setOculto(true);
      else if (ultimo - y > 6) setOculto(false);
      ultimo = y;
      clearTimeout(timer);
      timer = setTimeout(() => setOculto(false), 1200);
    };
    window.addEventListener('scroll', alScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', alScroll);
      clearTimeout(timer);
    };
  }, []);
  return oculto;
}

export function BotonFlotante({ icono: Icono, texto, onClick }) {
  const oculto = useOcultoAlBajar();
  return (
    <m.button
      type="button"
      initial={{ scale: 0.6, opacity: 0 }}
      animate={oculto ? { scale: 0.8, opacity: 0, y: 24 } : { scale: 1, opacity: 1, y: 0 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', damping: 22, stiffness: 380 }}
      style={{ pointerEvents: oculto ? 'none' : 'auto' }}
      onClick={onClick}
      className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 flex h-14 items-center gap-2 rounded-2xl bg-marca pr-5 pl-4 text-[15px] font-bold text-white shadow-[0_10px_28px_-6px_rgb(234_88_12/0.55)] md:right-8 md:bottom-8"
    >
      <Icono size={22} strokeWidth={2.4} />
      {texto}
    </m.button>
  );
}

/** conBoton: deja lugar abajo para que el botón flotante no tape la última fila. */
export function Contenido({ children, className = '', conBoton = false }) {
  return <div className={`mx-auto max-w-3xl px-4 ${conBoton ? 'pb-20' : ''} ${className}`}>{children}</div>;
}

export function Esqueleto({ filas = 5 }) {
  return (
    <div className="space-y-3 py-4" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="esqueleto h-16" style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}

export function Titulo({ children, derecha, className = '' }) {
  return (
    <div className={`flex items-center gap-2 px-1 pt-5 pb-2 ${className}`}>
      <h2 className="text-[13px] font-bold tracking-wide text-tinta-2 uppercase">{children}</h2>
      {derecha && <div className="ml-auto">{derecha}</div>}
    </div>
  );
}

/** Logo: casco de obra sobre naranja. */
export function Marca({ tam = 40 }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#ea580c" />
      <path d="M16 39a16 16 0 0 1 32 0z" fill="#fff" />
      <rect x="29" y="20" width="6" height="12" rx="3" fill="#ea580c" />
      <rect x="11" y="39" width="42" height="7" rx="3.5" fill="#fff" />
    </svg>
  );
}
