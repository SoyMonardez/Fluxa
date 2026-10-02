// F6: entregar varias herramientas del pañol a una cuadrilla de una sola vez.
import { useMemo, useState } from 'react';
import { PackagePlus, Plus, Truck, Wrench } from 'lucide-react';
import { moverHerramientas } from '../../lib/acciones';
import { avisar, avisarError } from '../../lib/avisos';
import { buscar, enPanol, stockPorHerramienta } from '../../lib/derivados';
import { abrir, cerrar } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import { vibrar } from '../../lib/vibrar';
import { Buscador, Contador } from '../../ui/campos';
import Hoja from '../../ui/Hoja';

export default function HojaEntregar({ cuadrillaId }) {
  const c = useEstado((s) => s.cuadrillas.find((x) => x.id === cuadrillaId));
  const encargado = useEstado((s) => s.obreros.find((o) => o.id === c?.encargado_id));
  const herramientas = useEstado((s) => s.herramientas);
  const stock = useEstado((s) => s.stock);
  const [elegidas, setElegidas] = useState({});
  const [texto, setTexto] = useState('');

  const disponibles = useMemo(() => {
    const porH = stockPorHerramienta(stock);
    return herramientas.map((h) => ({ h, hay: enPanol(h, porH.get(h.id)) })).filter((x) => x.hay > 0);
  }, [herramientas, stock]);
  const lista = disponibles.filter((x) => buscar(texto, x.h.nombre));
  const total = Object.values(elegidas).reduce((s, n) => s + n, 0);

  if (!c) return <Hoja titulo="Entregar" />;

  const poner = (id, n) => setElegidas((x) => ({ ...x, [id]: n }));

  function entregar() {
    const items = Object.entries(elegidas)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => ({ herramienta_id: id, cantidad: n }));
    try {
      moverHerramientas(null, c.id, items);
      vibrar(14);
      avisar(`Entregaste ${total} herramienta${total === 1 ? '' : 's'} a ${c.nombre}${encargado ? ` (responde ${encargado.nombre})` : ''}`);
      cerrar();
    } catch (e) {
      avisarError(e);
    }
  }

  return (
    <Hoja
      completo
      titulo={`Entregar a ${c.nombre}`}
      subtitulo={encargado ? `Queda a cargo de ${encargado.nombre}` : 'Ojo: esta cuadrilla no tiene encargado'}
      pie={
        <button type="button" className="btn btn-primario w-full" disabled={!total} onClick={entregar}>
          <PackagePlus size={19} /> {total ? `Entregar ${total} herramienta${total === 1 ? '' : 's'}` : 'Elegí qué se lleva'}
        </button>
      }
    >
      <div className="sticky top-0 z-10 -mx-5 flex gap-2 bg-superficie px-5 pb-3">
        <div className="flex-1">
          <Buscador valor={texto} onCambio={setTexto} placeholder="Buscar en el pañol" />
        </div>
        <button
          type="button"
          aria-label="Herramienta nueva"
          onClick={() => abrir('herramientaForm', { cuadrillaId: c.id })}
          className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[0.875rem] border border-borde bg-superficie-2"
        >
          <Plus size={19} />
        </button>
      </div>
      {!disponibles.length ? (
        <p className="py-10 text-center text-tinta-3">El pañol está vacío: todo está en obra.</p>
      ) : (
        <ul className="divide-y divide-borde">
          {lista.map(({ h, hay }) => {
            const n = elegidas[h.id] ?? 0;
            return (
              <li key={h.id} className="flex items-center gap-3 py-2">
                <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => n < hay && poner(h.id, n + 1)}>
                  <span
                    key={n}
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors ${n ? 'animar-latido bg-ok-suave text-ok' : 'bg-superficie-2 text-tinta-2'}`}
                  >
                    {h.tipo === 'maquina' ? <Truck size={18} /> : <Wrench size={18} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{h.nombre}</span>
                    <span className="num block text-xs text-tinta-3">hay {hay} en el pañol</span>
                  </span>
                </button>
                <Contador valor={n} min={0} max={hay} onCambio={(v) => poner(h.id, v)} />
              </li>
            );
          })}
        </ul>
      )}
    </Hoja>
  );
}
