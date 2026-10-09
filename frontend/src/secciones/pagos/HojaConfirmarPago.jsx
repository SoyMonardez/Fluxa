// F5 (final): resumen del pago antes de confirmarlo; después, compartir por WhatsApp.
import { useState } from 'react';
import { CloudOff, Share2 } from 'lucide-react';
import { pagar } from '../../lib/acciones';
import { avisar, avisarError } from '../../lib/avisos';
import { useDetallePago } from '../../lib/consultas';
import { conDia, hoy, rango, semanaDePago } from '../../lib/fechas';
import { jornales, mas, menos, pesos } from '../../lib/formato';
import { cerrar } from '../../lib/hojas';
import { compartir, resumenPago } from '../../lib/resumen';
import { useEstado } from '../../lib/store';
import { vibrar } from '../../lib/vibrar';
import { Renglon } from '../../ui/campos';
import Hoja from '../../ui/Hoja';

export default function HojaConfirmarPago({ hasta, items, totales, deudaQueda }) {
  const [fecha, setFecha] = useState(hoy);
  const [nota, setNota] = useState('');
  const [pagoId, setPagoId] = useState(null);
  const pago = useDetallePago(pagoId);
  const confirmado = useEstado((s) => s.pagosConfirmados.has(pagoId));
  const enLinea = useEstado((s) => s.enLinea);

  function confirmar() {
    try {
      const p = pagar({ hasta, fecha, nota, items });
      vibrar([18, 60, 18]);
      setPagoId(p.id);
    } catch (e) {
      avisarError(e);
    }
  }

  async function compartirResumen() {
    try {
      const r = await compartir(resumenPago({ hasta: pago.hasta, fecha: pago.fecha, items: pago.items, total: pago.total_neto }));
      if (r === 'copiado') avisar('Resumen copiado: pegalo en WhatsApp');
    } catch (e) {
      avisarError(e);
    }
  }

  if (pagoId && (!pago || pago.anulado)) {
    return (
      <Hoja titulo="El pago no quedó confirmado" pie={<button type="button" className="btn btn-primario w-full" onClick={() => cerrar()}>Revisar pagos</button>}>
        <p role="alert" className="rounded-2xl bg-mal-suave p-4 text-mal">
          El pago fue rechazado al sincronizar o se anuló desde otro dispositivo. Revisá el historial y los días pendientes antes de entregar dinero.
        </p>
      </Hoja>
    );
  }

  if (pago) {
    return (
      <Hoja
        titulo={confirmado ? 'Pago registrado' : 'Pago pendiente de sincronizar'}
        pie={
          <div className="flex gap-2">
            <button type="button" className="btn btn-suave flex-1" disabled={!confirmado} onClick={compartirResumen}>
              <Share2 size={18} /> Compartir
            </button>
            <button type="button" className="btn btn-primario flex-1" onClick={() => cerrar()}>
              Listo
            </button>
          </div>
        }
      >
        <div className="flex flex-col items-center py-4 text-center">
          <div className="animar-crecer grid h-24 w-24 place-items-center rounded-full bg-ok">
            <svg viewBox="0 0 24 24" className="h-12 w-12" aria-hidden="true">
              <path
                d="M4.5 12.5l4.6 4.6L19.5 6.8"
                pathLength={1}
                className="animar-trazo"
                style={{ animationDelay: '0.2s', animationDuration: '0.35s' }}
                fill="none"
                stroke="white"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="animar-subir" style={{ animationDelay: '0.25s' }}>
            <p className="num mt-4 text-3xl font-extrabold">{pesos(pago.total_neto)}</p>
            <p className="mt-1 text-tinta-2">
              {pago.items.length} obreros · pagado el {conDia(pago.fecha)}
            </p>
            <p className="mt-3 text-sm text-tinta-3">Los días quedaron pagados y bloqueados. Si hay que corregir algo, se puede anular desde el historial.</p>
            {!confirmado && (
              <p className="mt-3 flex items-start gap-2 rounded-2xl bg-deuda-suave p-3 text-left text-sm text-deuda">
                <CloudOff size={18} className="mt-px shrink-0" />
                {enLinea ? 'Esperando confirmación del servidor. ' : 'Se subirá cuando haya señal. '}
                Compartí el recibo una vez que termine de sincronizar.
              </p>
            )}
          </div>
        </div>
      </Hoja>
    );
  }

  return (
    <Hoja
      titulo="Confirmar pago"
      subtitulo={`Semana ${rango(semanaDePago(hasta))}`}
      pie={
        <button type="button" className="btn btn-primario h-14 w-full text-base" onClick={confirmar}>
          Confirmar pago de {pesos(totales.neto)}
        </button>
      }
    >
      <div className="rounded-3xl bg-superficie-2 p-4 text-center">
        <p className="text-xs font-bold tracking-wide text-tinta-3 uppercase">Total en efectivo</p>
        <p className="num text-4xl font-extrabold tracking-tight">{pesos(totales.neto)}</p>
        <p className="num mt-1 text-sm text-tinta-2">
          {items.length} obreros · {jornales(totales.jornales)} jornales
        </p>
      </div>
      <div className="mt-3 px-1 text-[15px]">
        <Renglon texto="Ganado" valor={pesos(totales.bruto)} />
        {totales.plus > 0 && <Renglon texto="Plus" valor={mas(totales.plus)} />}
        <Renglon texto="Adelantos descontados" valor={<span className="text-deuda">{menos(totales.descuento)}</span>} />
        <Renglon texto="Adelantos que quedan para después" valor={pesos(Math.max(0, deudaQueda))} className="border-t border-borde pt-2 text-sm" />
      </div>
      <div className="mt-4 grid grid-cols-[auto_1fr] gap-3">
        <div>
          <label htmlFor="fecha-pago" className="etiqueta">
            Fecha de pago
          </label>
          <input id="fecha-pago" type="date" className="campo" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value || hoy())} />
        </div>
        <div>
          <label htmlFor="nota-pago" className="etiqueta">
            Nota
          </label>
          <input id="nota-pago" className="campo" value={nota} maxLength={255} onChange={(e) => setNota(e.target.value)} placeholder="Opcional" />
        </div>
      </div>
    </Hoja>
  );
}
