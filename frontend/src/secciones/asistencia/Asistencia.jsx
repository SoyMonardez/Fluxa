// P1–P4: pasar lista, ajustar jornada, ver cuánto le queda a cada uno y dar adelantos.
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { CalendarDays, CloudOff, Ellipsis, HandCoins, List, Search, UserPlus } from 'lucide-react';
import { cargarAsistencia } from '../../lib/acciones';
import { agruparPorCuadrilla, buscar } from '../../lib/derivados';
import { diasDesde, larga, semanaDePago, sumarDias } from '../../lib/fechas';
import { useHoy } from '../../lib/useHoy';
import { abrir } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import { Buscador, Numero, Vacio } from '../../ui/campos';
import { BotonFlotante, BotonIcono, Contenido, Encabezado } from '../../ui/pagina';
import GrupoDia from './GrupoDia';
import TiraSemana from './TiraSemana';
import VistaSemana from './VistaSemana';

const deslizar = {
  entra: (d) => ({ x: d * 56, opacity: 0 }),
  quieto: { x: 0, opacity: 1, transition: { type: 'spring', damping: 30, stiffness: 330 } },
  sale: (d) => ({ x: d * -56, opacity: 0, transition: { duration: 0.14 } }),
};

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

export default function Asistencia() {
  const hoyStr = useHoy();
  // null = hoy (si la app queda abierta hasta el día siguiente, pasa sola al día nuevo)
  const [elegida, setElegida] = useState(null);
  const fecha = elegida ?? hoyStr;
  const [vista, setVista] = useState(() => leerPref('vista_asistencia', 'dia'));
  const [buscando, setBuscando] = useState(false);
  const [texto, setTexto] = useState('');
  const [dir, setDir] = useState(0);
  const [pista, setPista] = useState(() => leerPref('pista_tilde', '1') === '1');

  const obreros = useEstado((s) => s.obreros);
  const cuadrillas = useEstado((s) => s.cuadrillas);
  const asistencia = useEstado((s) => s.asistencia);
  const version = useEstado((s) => s.version);
  const cola = useEstado((s) => s.cola);

  const semana = useMemo(() => semanaDePago(fecha), [fecha]);
  const dias = useMemo(() => diasDesde(semana.desde), [semana.desde]);

  useEffect(() => {
    cargarAsistencia(semana.desde, semana.hasta).catch(() => {});
  }, [semana.desde, semana.hasta, version]);

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

  function alternarVista() {
    const v = vista === 'dia' ? 'semana' : 'dia';
    setVista(v);
    guardarPref('vista_asistencia', v);
  }

  function ocultarPista() {
    setPista(false);
    guardarPref('pista_tilde', '0');
  }

  const subtitulo = fecha === hoyStr ? `Hoy, ${larga(fecha)}` : larga(fecha);

  return (
    <>
      <Encabezado
        titulo="Asistencia"
        subtitulo={vista === 'dia' ? subtitulo : 'Toda la semana de pago'}
        derecha={
          <>
            {cola > 0 && (
              <BotonIcono icono={CloudOff} etiqueta={`${cola} sin subir`} onClick={() => abrir('menu')} className="text-deuda">
                <span className="absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-deuda px-1 text-[10px] font-bold text-white">{cola}</span>
              </BotonIcono>
            )}
            <BotonIcono icono={Search} etiqueta="Buscar obrero" activo={buscando} onClick={() => (setBuscando((b) => !b), setTexto(''))} />
            <BotonIcono icono={vista === 'dia' ? CalendarDays : List} etiqueta={vista === 'dia' ? 'Ver la semana' : 'Ver un día'} onClick={alternarVista} />
            <BotonIcono icono={Ellipsis} etiqueta="Menú" onClick={() => abrir('menu')} />
          </>
        }
      >
        <AnimatePresence initial={false}>
          {buscando && (
            <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="pt-2">
                <Buscador valor={texto} onCambio={setTexto} placeholder="Buscar por nombre o rol" autoFocus />
              </div>
            </m.div>
          )}
        </AnimatePresence>
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
                <m.div
                  className="h-full rounded-full bg-ok"
                  initial={false}
                  animate={{ width: `${activos.length ? (presentes / activos.length) * 100 : 0}%` }}
                  transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                />
              </div>
              {pista && (
                <button type="button" onClick={ocultarPista} className="mt-3 block text-left text-[13px] leading-snug text-tinta-3">
                  Tocá el círculo para marcar presente. <b className="text-tinta-2">Mantenelo apretado</b> para ½, 1½ (medio día más) o doble. Deslizá la lista
                  para cambiar de día. <span className="underline">Entendido</span>
                </button>
              )}
            </div>

            <div className="relative">
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <m.div
                  key={fecha}
                  custom={dir}
                  variants={deslizar}
                  initial="entra"
                  animate="quieto"
                  exit="sale"
                  drag="x"
                  dragDirectionLock
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.14}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -70 && fecha < hoyStr) cambiarDia(sumarDias(fecha, 1));
                    else if (info.offset.x > 70) cambiarDia(sumarDias(fecha, -1));
                  }}
                >
                  {grupos.map((g) => (
                    <GrupoDia key={g.cuadrilla?.id ?? 'sin'} grupo={g} fecha={fecha} registros={delDia} />
                  ))}
                  {!grupos.length && <p className="py-10 text-center text-tinta-3">Nadie coincide con “{texto}”.</p>}
                </m.div>
              </AnimatePresence>
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
