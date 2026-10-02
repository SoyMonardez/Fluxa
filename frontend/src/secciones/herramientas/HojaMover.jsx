// Enviar desde el pañol, devolver al pañol o mover entre cuadrillas. Con atajo a "Reclamo".
import { useState } from 'react';
import { ArrowRight, KeyRound, ShieldAlert, Warehouse } from 'lucide-react';
import { moverHerramientas } from '../../lib/acciones';
import { avisar, avisarError } from '../../lib/avisos';
import { enObras } from '../../lib/derivados';
import { colorDe } from '../../lib/formato';
import { cerrar, reemplazar } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import { vibrar } from '../../lib/vibrar';
import { Contador } from '../../ui/campos';
import Hoja from '../../ui/Hoja';

export default function HojaMover({ herramientaId, desde = null }) {
  const h = useEstado((s) => s.herramientas.find((x) => x.id === herramientaId));
  const stock = useEstado((s) => s.stock);
  const cuadrillas = useEstado((s) => s.cuadrillas);
  const obreros = useEstado((s) => s.obreros);

  const lugares = stock.filter((s) => s.herramienta_id === herramientaId);
  const hay = desde == null ? (h?.cantidad ?? 0) - enObras(lugares) : (lugares.find((l) => l.cuadrilla_id === desde)?.cantidad ?? 0);
  const origen = cuadrillas.find((c) => c.id === desde);
  const destinos = [...(desde != null ? [{ id: null, nombre: 'Pañol', color: null }] : []), ...cuadrillas.filter((c) => c.id !== desde)];

  const [cantidad, setCantidad] = useState(desde == null ? 1 : hay);
  const [hacia, setHacia] = useState(desde != null ? null : (destinos[0]?.id ?? null));
  const [enviando, setEnviando] = useState(false);

  if (!h) return <Hoja titulo="Mover" />;
  const destino = destinos.find((d) => d.id === hacia);
  const encargadoDe = (c) => obreros.find((o) => o.id === c?.encargado_id)?.nombre;
  const n = Math.min(Math.max(1, cantidad), hay);

  async function mover() {
    setEnviando(true);
    try {
      await moverHerramientas(desde, hacia, [{ herramienta_id: h.id, cantidad: n }]);
      vibrar(12);
      avisar(hacia == null ? `${n} × ${h.nombre} volvieron al pañol` : `${n} × ${h.nombre} → ${destino.nombre}`);
      cerrar();
    } catch (e) {
      avisarError(e);
      setEnviando(false);
    }
  }

  const accion = hacia == null ? 'Devolver al pañol' : `${desde == null ? 'Enviar' : 'Mover'} a ${destino?.nombre ?? '…'}`;

  return (
    <Hoja
      titulo={h.nombre}
      subtitulo={`${origen ? `En ${origen.nombre}` : 'En el pañol'}: ${hay} unidad${hay === 1 ? '' : 'es'}${origen && encargadoDe(origen) ? ` · responde ${encargadoDe(origen)}` : ''}`}
      pie={
        <button type="button" className="btn btn-primario w-full" disabled={!hay || enviando || (desde == null && hacia == null)} onClick={mover}>
          {accion}
        </button>
      }
    >
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-superficie-2 p-3">
        <span className="font-semibold">Cantidad</span>
        <Contador valor={n} min={1} max={hay} onCambio={setCantidad} />
      </div>

      <p className="etiqueta mt-4">¿A dónde va?</p>
      {!destinos.length ? (
        <p className="text-sm text-tinta-3">No hay cuadrillas a donde mandarla.</p>
      ) : (
        <ul className="space-y-2">
          {destinos.map((d) => {
            const activo = d.id === hacia;
            const enc = d.id != null ? encargadoDe(d) : null;
            return (
              <li key={d.id ?? 'panol'}>
                <button
                  type="button"
                  onClick={() => setHacia(d.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left ${activo ? 'border-tinta bg-superficie-2' : 'border-borde'}`}
                >
                  {d.id == null ? (
                    <Warehouse size={20} className="text-tinta-2" />
                  ) : (
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: colorDe(d.color) }} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{d.nombre}</span>
                    {d.id != null && (
                      <span className={`flex items-center gap-1 text-xs ${enc ? 'text-tinta-3' : 'text-mal'}`}>
                        <KeyRound size={11} /> {enc ?? 'Sin encargado'}
                      </span>
                    )}
                  </span>
                  {activo && <ArrowRight size={18} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {desde != null && (
        <button
          type="button"
          onClick={() => reemplazar('reclamo', { herramientaId: h.id, cuadrillaId: desde })}
          className="btn btn-peligro mt-5 w-full text-sm"
        >
          <ShieldAlert size={18} /> Reclamo: robo, faltante o rotura
        </button>
      )}
    </Hoja>
  );
}
