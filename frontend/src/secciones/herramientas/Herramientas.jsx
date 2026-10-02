// P8: inventario de herramientas y máquinas, y dónde está cada una.
import { useMemo, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Plus, Search, Truck, Wrench } from 'lucide-react';
import { buscar, enObras, stockPorHerramienta } from '../../lib/derivados';
import { colorDe } from '../../lib/formato';
import { abrir } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import { Buscador, Vacio } from '../../ui/campos';
import { BotonFlotante, BotonIcono, Contenido, Encabezado } from '../../ui/pagina';

const FILTROS = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'maquina', texto: 'Máquinas' },
  { valor: 'herramienta', texto: 'Herramientas' },
  { valor: 'panol', texto: 'En el pañol' },
  { valor: 'obra', texto: 'En obra' },
];

export default function Herramientas() {
  const herramientas = useEstado((s) => s.herramientas);
  const stock = useEstado((s) => s.stock);
  const cuadrillas = useEstado((s) => s.cuadrillas);
  const [filtro, setFiltro] = useState('todas');
  const [buscando, setBuscando] = useState(false);
  const [texto, setTexto] = useState('');

  const porH = useMemo(() => stockPorHerramienta(stock), [stock]);
  const cuadrillaDe = useMemo(() => new Map(cuadrillas.map((c) => [c.id, c])), [cuadrillas]);

  const filas = useMemo(
    () =>
      herramientas.map((h) => {
        const lugares = (porH.get(h.id) ?? []).filter((l) => cuadrillaDe.has(l.cuadrilla_id));
        const obra = enObras(lugares);
        return { h, lugares, obra, panol: h.cantidad - obra };
      }),
    [herramientas, porH, cuadrillaDe]
  );

  const lista = filas.filter(({ h, panol, obra, lugares }) => {
    if (filtro === 'maquina' || filtro === 'herramienta') {
      if (h.tipo !== filtro) return false;
    } else if (filtro === 'panol' && panol <= 0) return false;
    else if (filtro === 'obra' && obra <= 0) return false;
    return buscar(texto, h.nombre, h.nota, ...lugares.map((l) => cuadrillaDe.get(l.cuadrilla_id)?.nombre));
  });

  const unidades = filas.reduce((s, f) => s + f.h.cantidad, 0);
  const enPanol = filas.reduce((s, f) => s + f.panol, 0);

  return (
    <>
      <Encabezado
        titulo="Herramientas"
        subtitulo={`${unidades} unidades · ${enPanol} en el pañol · ${unidades - enPanol} en obra`}
        derecha={<BotonIcono icono={Search} etiqueta="Buscar" activo={buscando} onClick={() => (setBuscando((b) => !b), setTexto(''))} />}
      >
        <AnimatePresence initial={false}>
          {buscando && (
            <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="pt-2">
                <Buscador valor={texto} onCambio={setTexto} placeholder="¿Qué buscás? Ej: hormigonera" autoFocus />
              </div>
            </m.div>
          )}
        </AnimatePresence>
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => setFiltro(f.valor)}
              className={`chip h-8 shrink-0 border px-3 text-[13px] ${filtro === f.valor ? 'border-tinta bg-tinta text-superficie' : 'border-borde bg-superficie text-tinta-2'}`}
            >
              {f.texto}
            </button>
          ))}
        </div>
      </Encabezado>

      <Contenido conBoton>
        {!herramientas.length ? (
          <Vacio icono={Wrench} titulo="Pasá tu cuaderno de herramientas" texto="Cargá cada herramienta o máquina con la cantidad que tiene la empresa. Después las repartís a las cuadrillas.">
            <button type="button" className="btn btn-primario" onClick={() => abrir('herramientaForm')}>
              <Plus size={18} /> Nueva herramienta
            </button>
          </Vacio>
        ) : (
          <ul className="tarjeta mt-3 divide-y divide-borde overflow-hidden">
            {lista.map(({ h, lugares, panol }) => (
              <li key={h.id}>
                <button type="button" onClick={() => abrir('herramienta', { herramientaId: h.id })} className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-superficie-2">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-superficie-2 text-tinta-2">
                    {h.tipo === 'maquina' ? <Truck size={19} /> : <Wrench size={19} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="min-w-0 flex-1 truncate font-semibold">{h.nombre}</p>
                      <span className="num shrink-0 text-sm font-bold">{h.cantidad} u.</span>
                    </div>
                    <Reparto total={h.cantidad} panol={panol} lugares={lugares} cuadrillaDe={cuadrillaDe} />
                    <p className="mt-1 truncate text-xs text-tinta-3">
                      {[panol > 0 ? `${panol} en pañol` : null, ...lugares.map((l) => `${l.cantidad} ${cuadrillaDe.get(l.cuadrilla_id)?.nombre}`)]
                        .filter(Boolean)
                        .join(' · ') || 'Sin unidades (dadas de baja)'}
                    </p>
                  </div>
                </button>
              </li>
            ))}
            {!lista.length && <li className="py-10 text-center text-tinta-3">No hay herramientas con ese filtro.</li>}
          </ul>
        )}
      </Contenido>
      <BotonFlotante icono={Plus} texto="Herramienta" onClick={() => abrir('herramientaForm')} />
    </>
  );
}

/** Barra con el reparto: gris = pañol, colores = cuadrillas. */
function Reparto({ total, panol, lugares, cuadrillaDe }) {
  if (!total) return <div className="mt-1.5 h-1.5 rounded-full bg-superficie-2" />;
  return (
    <div className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
      {panol > 0 && <span className="h-full rounded-full bg-tinta-3/40" style={{ flex: panol }} />}
      {lugares.map((l) => (
        <m.span
          key={l.cuadrilla_id}
          layout
          className="h-full rounded-full"
          style={{ flex: l.cantidad, background: colorDe(cuadrillaDe.get(l.cuadrilla_id)?.color) }}
        />
      ))}
    </div>
  );
}
