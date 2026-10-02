// Marco de la app: barra de secciones (abajo en el celular, al costado en la compu).
import { useEffect, useLayoutEffect, useRef } from 'react';
import { m } from 'motion/react';
import { ClipboardCheck, HardHat, Settings, Users, Wallet, Wrench } from 'lucide-react';
import { iniciar } from '../lib/acciones';
import { avisarError } from '../lib/avisos';
import { abrir, cerrarTodo, hayHojas } from '../lib/hojas';
import { ir, useSeccion } from '../lib/ruta';
import { useEstado } from '../lib/store';
import { vibrar } from '../lib/vibrar';
import { Esqueleto, Marca } from '../ui/pagina';
import Asistencia from '../secciones/asistencia/Asistencia';
import Pagos from '../secciones/pagos/Pagos';
import Cuadrillas from '../secciones/cuadrillas/Cuadrillas';
import Herramientas from '../secciones/herramientas/Herramientas';
import Obreros from '../secciones/obreros/Obreros';

const SECCIONES = [
  { id: 'asistencia', texto: 'Asistencia', icono: ClipboardCheck, Pagina: Asistencia },
  { id: 'pagos', texto: 'Pagos', icono: Wallet, Pagina: Pagos },
  { id: 'cuadrillas', texto: 'Cuadrillas', icono: HardHat, Pagina: Cuadrillas },
  { id: 'herramientas', texto: 'Herramientas', icono: Wrench, Pagina: Herramientas },
  { id: 'obreros', texto: 'Obreros', icono: Users, Pagina: Obreros },
];

const scrolls = {};

function navegar(id) {
  if (hayHojas()) cerrarTodo();
  vibrar(6);
  ir(id);
}

export default function Shell() {
  const seccion = useSeccion();
  const listo = useEstado((s) => s.listo);
  const { Pagina } = SECCIONES.find((s) => s.id === seccion) ?? SECCIONES[0];
  const anterior = useRef(seccion);

  useEffect(() => {
    iniciar().catch(avisarError);
  }, []);

  // Cada sección recuerda hasta dónde se había bajado.
  useLayoutEffect(() => {
    if (anterior.current !== seccion) {
      window.scrollTo(0, scrolls[seccion] ?? 0);
      anterior.current = seccion;
    }
    const guardar = () => {
      scrolls[seccion] = window.scrollY;
    };
    window.addEventListener('scroll', guardar, { passive: true });
    return () => window.removeEventListener('scroll', guardar);
  }, [seccion]);

  return (
    <div className="min-h-dvh md:pl-64">
      <BarraLateral seccion={seccion} />
      <main className="pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12">
        <m.div key={seccion} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
          {listo ? <Pagina /> : <Esqueleto filas={7} />}
        </m.div>
      </main>
      <BarraInferior seccion={seccion} />
    </div>
  );
}

function BarraInferior({ seccion }) {
  return (
    <nav className="pb-seguro fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-superficie/92 backdrop-blur-xl md:hidden" aria-label="Secciones">
      <div className="mx-auto flex max-w-lg">
        {SECCIONES.map(({ id, texto, icono: Icono }) => {
          const activo = id === seccion;
          return (
            <button
              key={id}
              type="button"
              onClick={() => navegar(id)}
              aria-current={activo ? 'page' : undefined}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[min(10.5px,2.75vw)] font-semibold tracking-tight ${
                activo ? 'text-tinta' : 'text-tinta-3'
              }`}
            >
              <span className="relative grid h-8 w-14 place-items-center">
                {activo && (
                  <m.span layoutId="pestana" className="absolute inset-0 rounded-full bg-marca-suave" transition={{ type: 'spring', damping: 30, stiffness: 420 }} />
                )}
                <Icono size={22} strokeWidth={activo ? 2.4 : 2} className={`relative ${activo ? 'text-marca' : ''}`} />
              </span>
              <span className="max-w-full truncate">{texto}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function BarraLateral({ seccion }) {
  const usuario = useEstado((s) => s.sesion?.usuario);
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-borde bg-superficie md:flex">
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <Marca tam={40} />
        <div>
          <p className="text-lg leading-none font-extrabold">ETEM</p>
          <p className="text-xs text-tinta-3">Obras</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {SECCIONES.map(({ id, texto, icono: Icono }) => {
          const activo = id === seccion;
          return (
            <button
              key={id}
              type="button"
              onClick={() => navegar(id)}
              className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold ${
                activo ? 'text-tinta' : 'text-tinta-2 hover:bg-superficie-2'
              }`}
            >
              {activo && <m.span layoutId="pestana-lateral" className="absolute inset-0 rounded-xl bg-marca-suave" />}
              <Icono size={20} className={`relative ${activo ? 'text-marca' : ''}`} />
              <span className="relative">{texto}</span>
            </button>
          );
        })}
      </nav>
      <div className="border-t border-borde p-3">
        <button type="button" onClick={() => abrir('menu')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-superficie-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-superficie-2 text-sm font-bold uppercase">{usuario?.[0] ?? '?'}</span>
          <span className="flex-1 text-sm font-semibold">{usuario}</span>
          <Settings size={18} className="text-tinta-3" />
        </button>
      </div>
    </aside>
  );
}
