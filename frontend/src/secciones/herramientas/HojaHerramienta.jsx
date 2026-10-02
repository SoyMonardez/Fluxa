// Una herramienta: dónde está cada unidad, quién responde, y acciones.
import { KeyRound, PackagePlus, Pencil, ShieldAlert, Trash2, Truck, Warehouse, Wrench } from 'lucide-react';
import { borrarHerramienta } from '../../lib/acciones';
import { avisar } from '../../lib/avisos';
import { useMovimientos } from '../../lib/consultas';
import { enObras } from '../../lib/derivados';
import { colorDe, pesos } from '../../lib/formato';
import { abrir } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import Hoja from '../../ui/Hoja';
import ListaMovimientos from '../../ui/ListaMovimientos';

export default function HojaHerramienta({ herramientaId }) {
  const h = useEstado((s) => s.herramientas.find((x) => x.id === herramientaId));
  const stock = useEstado((s) => s.stock);
  const cuadrillas = useEstado((s) => s.cuadrillas);
  const obreros = useEstado((s) => s.obreros);
  const movs = useMovimientos({ herramientaId, limite: 20 });

  if (!h) return <Hoja titulo="Herramienta" />;

  const lugares = stock.filter((s) => s.herramienta_id === h.id && cuadrillas.some((c) => c.id === s.cuadrilla_id));
  const panol = h.cantidad - enObras(lugares);
  const nombreDe = (id) => obreros.find((o) => o.id === id)?.nombre;

  function borrar() {
    abrir('confirmar', {
      titulo: `Borrar ${h.nombre}`,
      texto: 'Deja de aparecer en el inventario. El historial de movimientos se conserva.',
      confirmar: 'Borrar',
      peligro: true,
      onConfirmar: () => {
        borrarHerramienta(h.id);
        avisar(`${h.nombre} borrada`);
        return 2;
      },
    });
  }

  return (
    <Hoja
      completo
      titulo={h.nombre}
      subtitulo={`${h.tipo === 'maquina' ? 'Máquina' : 'Herramienta'} · ${h.cantidad} unidad${h.cantidad === 1 ? '' : 'es'}${h.valor ? ` · vale ${pesos(h.valor)} c/u` : ''}`}
      acciones={
        <button type="button" aria-label="Editar" onClick={() => abrir('herramientaForm', { herramientaId: h.id })} className="grid h-9 w-9 place-items-center rounded-full bg-superficie-2 text-tinta-2">
          <Pencil size={16} />
        </button>
      }
    >
      {h.nota && <p className="mb-3 rounded-2xl bg-superficie-2 p-3 text-sm text-tinta-2">{h.nota}</p>}

      <h3 className="mb-2 font-bold">Dónde está</h3>
      <ul className="divide-y divide-borde rounded-2xl border border-borde">
        <li className="flex items-center gap-3 px-3 py-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-superficie-2 text-tinta-2">
            <Warehouse size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Pañol</span>
            <span className="block text-xs text-tinta-3">Para repartir</span>
          </span>
          <span className="num chip bg-superficie-2 text-sm">× {panol}</span>
          <button
            type="button"
            disabled={panol <= 0 || !cuadrillas.length}
            onClick={() => abrir('mover', { herramientaId: h.id, desde: null })}
            className="btn btn-suave h-9 min-h-0 px-3 text-sm"
          >
            Enviar
          </button>
        </li>
        {lugares.map((l) => {
          const c = cuadrillas.find((x) => x.id === l.cuadrilla_id);
          const encargado = nombreDe(c.encargado_id);
          return (
            <li key={l.cuadrilla_id}>
              <button type="button" onClick={() => abrir('mover', { herramientaId: h.id, desde: c.id })} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, ${colorDe(c.color)} 18%, transparent)` }}>
                  <span className="h-3 w-3 rounded-full" style={{ background: colorDe(c.color) }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.nombre}</span>
                  <span className={`flex items-center gap-1 text-xs ${encargado ? 'text-tinta-3' : 'font-semibold text-mal'}`}>
                    <KeyRound size={11} /> {encargado ? `Responde ${encargado}` : 'Sin encargado'}
                  </span>
                </span>
                <span className="num chip bg-superficie-2 text-sm">× {l.cantidad}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {lugares.length > 0 && <p className="mt-2 text-xs text-tinta-3">Tocá una cuadrilla para devolver, mover o hacer un reclamo.</p>}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-suave px-3 text-sm whitespace-nowrap" onClick={() => abrir('sumarUnidades', { herramientaId: h.id })}>
          <PackagePlus size={18} /> Sumar unidades
        </button>
        <button
          type="button"
          className="btn btn-peligro px-3 text-sm"
          disabled={!h.cantidad}
          onClick={() => abrir('reclamo', { herramientaId: h.id, cuadrillaId: lugares.length === 1 && panol === 0 ? lugares[0].cuadrilla_id : null, elegirLugar: true })}
        >
          <ShieldAlert size={18} /> Reclamo
        </button>
      </div>

      <h3 className="mt-6 mb-2 flex items-center gap-2 font-bold">
        {h.tipo === 'maquina' ? <Truck size={17} className="text-tinta-3" /> : <Wrench size={17} className="text-tinta-3" />} Historial
      </h3>
      <ListaMovimientos movimientos={movs} conHerramienta={false} />

      {enObras(lugares) === 0 && (
        <button type="button" onClick={borrar} className="btn mt-6 w-full text-sm text-mal">
          <Trash2 size={17} /> Borrar del inventario
        </button>
      )}
    </Hoja>
  );
}
