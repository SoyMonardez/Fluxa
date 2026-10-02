// P1–P4: pasar lista, ajustar jornada, ver cuánto le queda a cada uno y dar adelantos.
import { useMemo, useRef, useState } from 'react';
import { CalendarDays, Ellipsis, HandCoins, List, Search, UserPlus } from 'lucide-react';
import { agruparPorCuadrilla, buscar } from '../../lib/derivados';
import { corta, diasDesde, larga, nombreDia, semanaDePago, sumarDias } from '../../lib/fechas';
import { useHoy } from '../../lib/useHoy';
import { abrir } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import { BuscadorPlegable, Numero, Vacio } from '../../ui/campos';
import { BotonFlotante, BotonIcono, Contenido, Encabezado } from '../../ui/pagina';
import { useBusqueda } from '../../ui/useBusqueda';
import GrupoDia from './GrupoDia';
import TiraSemana from './TiraSemana';
import VistaSemana from './VistaSemana';

const leerPref = (k, def) => {
  try {
    return localStorage.getItem(`etem_${k}`) || def;
  } catch {
    return def;
  }
};
const guardarPref = (k, v) => {
  try {
    localStorage.setItem(`etem_${k}`, v);
  } catch {
    /* nada */
  }
};

/**
 * Deslizar la lista de costado para cambiar de día. La lista sigue al dedo y,
 * pasado un umbral, cambia. El desplazamiento vertical lo sigue haciendo el navegador.
 */
function useDeslizar(alSiguiente, alAnterior) {
  const gesto = useRef(null);
  const anularClic = useRef(false);

  function terminar(cancelado) {
    const g = gesto.current;
    gesto.current = null;
    if (!g || g.modo !== 'x') return;
    g.el.style.transition = 'transform 0.3s var(--resorte), opacity 0.2s';
    g.el.style.transform = '';
    g.el.style.opacity = '';
    anularClic.current = true;
    setTimeout(() => (anularClic.current = false), 0);
    if (cancelado) return;
    if (g.dx < -70) alSiguiente();
    else if (g.dx > 70) alAnterior();
  }

  return {
    onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      gesto.current = { el: e.currentTarget, x0: e.clientX, y0: e.clientY, dx: 0, modo: null };
    },
    onPointerMove(e) {
      const g = gesto.current;
      if (!g) return;
      const dx = e.clientX - g.x0;
      const dy = e.clientY - g.y0;
      if (!g.modo) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        g.modo = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      }
      if (g.modo !== 'x') return;
      g.dx = dx;
      g.el.style.transition = 'none';
      g.el.style.transform = `translateX(${dx * 0.4}px)`;
      g.el.style.opacity = String(1 - Math.min(Math.abs(dx) / 700, 0.35));
    },
    onPointerUp: () => terminar(false),
    onPointerCancel: () => terminar(true),
    // Después de deslizar no vale como toque (no marca a nadie sin querer).
    onClickCapture(e) {
      if (anularClic.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
  };
}

export default function Asistencia() {
  const hoyStr = useHoy();
  // null = hoy (si la app queda abierta hasta el día siguiente, pasa sola al día nuevo)
  const [elegida, setElegida] = useState(null);
  const fecha = elegida ?? hoyStr;
  const [vista, setVista] = useState(() => leerPref('vista_asistencia', 'dia'));
  const busqueda = useBusqueda();
  const texto = busqueda.texto;
  const [dir, setDir] = useState(0);
  const [pista, setPista] = useState(() => leerPref('pista_tilde', '1') === '1');

  const obreros = useEstado((s) => s.obreros);
  const cuadrillas = useEstado((s) => s.cuadrillas);
  const asistencia = useEstado((s) => s.asistencia);

  const semana = useMemo(() => semanaDePago(fecha), [fecha]);
  const dias = useMemo(() => diasDesde(semana.desde), [semana.desde]);

  const activos = useMemo(() => obreros.filter((o) => o.activo), [obreros]);
  const grupos = useMemo(
    () =>
      agruparPorCuadrilla(obreros, cuadrillas)
        .map((g) => ({ ...g, obreros: g.obreros.filter((o) => buscar(texto, o.nombre, o.rol)) }))
        .filter((g) => g.obreros.length),
    [obreros, cuadrillas, texto]
  );

  const delDia = asistencia[fecha] || {};
  const presentes = activos.filter((o) => delDia[o.id]?.jornales > 0).length;
  const totalDia = activos.reduce((s, o) => s + (delDia[o.id]?.jornales || 0) * o.jornal, 0);

  function cambiarDia(nueva) {
    const destino = nueva > hoyStr ? hoyStr : nueva;
    if (destino === fecha) return;
    setDir(destino > fecha ? 1 : -1);
    setElegida(destino === hoyStr ? null : destino);
  }

  const deslizar = useDeslizar(
    () => fecha < hoyStr && cambiarDia(sumarDias(fecha, 1)),
    () => cambiarDia(sumarDias(fecha, -1))
  );

  function alternarVista() {
    const v = vista === 'dia' ? 'semana' : 'dia';
    setVista(v);
    guardarPref('vista_asistencia', v);
  }

  function ocultarPista() {
    setPista(false);
    guardarPref('pista_tilde', '0');
  }

  const subtitulo = fecha === hoyStr ? `Hoy, ${nombreDia(fecha)} ${corta(fecha)}` : larga(fecha);
  const entrada = dir > 0 ? 'animar-desde-derecha' : dir < 0 ? 'animar-desde-izquierda' : '';

  return (
    <>
      <Encabezado
        titulo="Asistencia"
        subtitulo={vista === 'dia' ? subtitulo : 'Toda la semana de pago'}
        derecha={
          <>
            <BotonIcono icono={Search} etiqueta="Buscar obrero" activo={busqueda.buscando} onClick={busqueda.alternar} />
            <BotonIcono icono={vista === 'dia' ? CalendarDays : List} etiqueta={vista === 'dia' ? 'Ver la semana' : 'Ver un día'} onClick={alternarVista} />
            <BotonIcono icono={Ellipsis} etiqueta="Menú" onClick={() => abrir('menu')} />
          </>
        }
      >
        <BuscadorPlegable busqueda={busqueda} placeholder="Buscar por nombre o rol" />
        <TiraSemana
          vista={vista}
          dias={dias}
          fecha={fecha}
          hoy={hoyStr}
          semana={semana}
          asistencia={asistencia}
          activos={activos}
          onElegir={cambiarDia}
          onSemana={(n) => cambiarDia(n < 0 ? sumarDias(semana.hasta, -7) : sumarDias(semana.hasta, 7))}
        />
      </Encabezado>

      <Contenido conBoton>
        {!activos.length ? (
          <Vacio icono={UserPlus} titulo="Todavía no hay obreros" texto="Cargá a tu gente con su jornal por día y después marcás la asistencia con un toque.">
            <button type="button" className="btn btn-primario" onClick={() => abrir('obreroForm')}>
              Cargar el primero
            </button>
          </Vacio>
        ) : vista === 'dia' ? (
          <>
            <div className="tarjeta mt-3 p-4">
              <div className="flex items-end justify-between gap-3">
                <p className="num text-[1.7rem] leading-none font-extrabold">
                  {presentes}
                  <span className="text-base font-bold text-tinta-3"> de {activos.length} presentes</span>
                </p>
                <div className="text-right">
                  <p className="text-xs font-semibold text-tinta-3">Jornales del día</p>
                  <Numero valor={totalDia} className="text-lg font-bold" />
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-superficie-2">
                <div
                  className="h-full rounded-full bg-ok transition-[width] duration-500 ease-[var(--resorte)]"
                  style={{ width: `${activos.length ? (presentes / activos.length) * 100 : 0}%` }}
                />
              </div>
              {pista && (
                <button type="button" onClick={ocultarPista} className="mt-3 block text-left text-[13px] leading-snug text-tinta-3">
                  Tocá el círculo para marcar presente. <b className="text-tinta-2">Mantenelo apretado</b> para ½, 1½ (medio día más) o doble. Deslizá la lista
                  para cambiar de día. <span className="underline">Entendido</span>
                </button>
              )}
            </div>

            <div key={fecha} {...deslizar} className={`touch-pan-y ${entrada}`}>
              {grupos.map((g) => (
                <GrupoDia key={g.cuadrilla?.id ?? 'sin'} grupo={g} fecha={fecha} registros={delDia} />
              ))}
              {!grupos.length && <p className="py-10 text-center text-tinta-3">Nadie coincide con “{texto}”.</p>}
            </div>
          </>
        ) : (
          <VistaSemana grupos={grupos} dias={dias} asistencia={asistencia} hoy={hoyStr} />
        )}
      </Contenido>

      {vista === 'dia' && activos.length > 0 && (
        <BotonFlotante
          icono={HandCoins}
          texto="Adelanto"
          onClick={() => abrir('elegirObrero', { titulo: '¿A quién le das el adelanto?', siguiente: 'adelanto' })}
        />
      )}
    </>
  );
}
