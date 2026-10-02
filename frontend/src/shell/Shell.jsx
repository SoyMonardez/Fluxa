// Marco de la app: barra de secciones (abajo en el celular, al costado en la compu).
import { Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { ClipboardCheck, CloudOff, HardHat, Settings, Users, Wallet, Wrench } from 'lucide-react';
import { abrir, cerrarTodo, hayHojas } from '../lib/hojas';
import { ir, useSeccion } from '../lib/ruta';
import { perezoso, precargarTodo } from '../lib/perezoso';
import { useEstado } from '../lib/store';
import { vibrar } from '../lib/vibrar';
import BannerInstalar from '../ui/BannerInstalar';
import EstadoRed from '../ui/EstadoRed';
import { Esqueleto, Marca } from '../ui/pagina';
import Asistencia from '../secciones/asistencia/Asistencia';

const Pagos = perezoso(() => import('../secciones/pagos/Pagos'));
const Cuadrillas = perezoso(() => import('../secciones/cuadrillas/Cuadrillas'));
const Herramientas = perezoso(() => import('../secciones/herramientas/Herramientas'));
const Obreros = perezoso(() => import('../secciones/obreros/Obreros'));

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

  // Con la primera pantalla ya dibujada, se trae el resto de la app.
  useEffect(() => {
    if (!listo) return undefined;
    const t = setTimeout(precargarTodo, 250);
    return () => clearTimeout(t);
  }, [listo]);

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
        <div key={seccion} className="animar-pagina">
          <Suspense fallback={<Cargando />}>{listo ? <Pagina /> : <Cargando />}</Suspense>
        </div>
      </main>
      <BarraInferior seccion={seccion} />
      {listo && <BannerInstalar />}
    </div>
  );
}

/** Primera carga en este teléfono: hace falta señal una vez para bajar los datos. */
function Cargando() {
  const red = useEstado((s) => s.red);
  const errorRed = useEstado((s) => s.errorRed);
  return (
    <div className="mx-auto max-w-3xl px-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
      {(red === 'sin-senal' || red === 'error') && (
        <div className="animar-aparecer mb-1 flex items-start gap-3 rounded-2xl bg-deuda-suave p-3 text-sm text-deuda">
          <CloudOff size={20} className="mt-px shrink-0" />
          <p>
            {red === 'error' ? errorRed : 'Sin señal.'} Para la primera carga en este teléfono hace falta conexión; se reintenta solo. Después la app funciona
            sin señal.
          </p>
        </div>
      )}
      <Esqueleto filas={7} />
    </div>
  );
}

function BarraInferior({ seccion }) {
  const i = Math.max(0, SECCIONES.findIndex((s) => s.id === seccion));
  return (
    <nav className="pb-seguro fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-superficie/92 backdrop-blur-xl md:hidden" aria-label="Secciones">
      <div className="relative mx-auto flex max-w-lg">
        {/* Píldora que se desliza hasta la sección elegida. */}
        <span
          aria-hidden="true"
          className="absolute top-2 left-0 h-8 transition-transform duration-[450ms] ease-[var(--resorte-pildora)]"
          style={{ width: `${100 / SECCIONES.length}%`, transform: `translateX(${i * 100}%)` }}
        >
          <span className="mx-auto block h-8 w-14 rounded-full bg-marca-suave" />
        </span>
        {SECCIONES.map(({ id, texto, icono: Icono }) => {
          const activo = id === seccion;
          return (
            <button
              key={id}
              type="button"
              onClick={() => navegar(id)}
              aria-current={activo ? 'page' : undefined}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[min(10.5px,2.75vw)] font-semibold tracking-tight transition-colors ${
                activo ? 'text-tinta' : 'text-tinta-3'
              }`}
            >
              <span className="grid h-8 w-14 place-items-center">
                <Icono size={22} strokeWidth={activo ? 2.4 : 2} className={`transition-transform duration-300 ${activo ? 'scale-110 text-marca' : ''}`} />
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
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors ${
                activo ? 'bg-marca-suave text-tinta' : 'text-tinta-2 hover:bg-superficie-2'
              }`}
            >
              <Icono size={20} className={activo ? 'text-marca' : ''} />
              <span>{texto}</span>
            </button>
          );
        })}
      </nav>
      <div className="flex items-center gap-1 border-t border-borde p-3">
        <button type="button" onClick={() => abrir('menu')} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-superficie-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-superficie-2 text-sm font-bold uppercase">{usuario?.[0] ?? '?'}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{usuario}</span>
          <Settings size={18} className="text-tinta-3" />
        </button>
        <EstadoRed />
      </div>
    </aside>
  );
}
