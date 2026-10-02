// Detalle de un pago hecho: recibo por obrero (WhatsApp), compartir y anular.
import { MessageCircle, Share2, Undo2 } from 'lucide-react';
import { anularPago } from '../../lib/acciones';
import { avisar, avisarError } from '../../lib/avisos';
import { useDetallePago } from '../../lib/consultas';
import { conDia, rango, semanaDePago } from '../../lib/fechas';
import { jornales, mas, menos, pesos, whatsapp } from '../../lib/formato';
import { abrir } from '../../lib/hojas';
import { compartir, reciboObrero, resumenPago } from '../../lib/resumen';
import Hoja from '../../ui/Hoja';

export default function HojaDetallePago({ pagoId }) {
  const pago = useDetallePago(pagoId);

  async function compartirResumen() {
    try {
      const r = await compartir(resumenPago({ hasta: pago.hasta, fecha: pago.fecha, items: pago.items, total: pago.total_neto }));
      if (r === 'copiado') avisar('Resumen copiado: pegalo en WhatsApp');
    } catch (e) {
      avisarError(e);
    }
  }

  function anular() {
    abrir('confirmar', {
      titulo: 'Anular este pago',
      texto: (
        <>
          Los días de estos {pago.items.length} obreros vuelven a quedar <b>sin pagar</b> y los adelantos descontados vuelven a quedar <b>pendientes</b>. Usalo
          sólo si te equivocaste al cargarlo.
        </>
      ),
      confirmar: 'Anular pago',
      peligro: true,
      onConfirmar: () => {
        anularPago(pago.id);
        avisar('Pago anulado');
        return 2;
      },
    });
  }

  return (
    <Hoja
      completo
      titulo={pago ? `Pago del ${conDia(pago.fecha)}` : 'Pago'}
      subtitulo={pago ? `Semana ${rango(semanaDePago(pago.hasta))}` : ''}
      pie={
        pago &&
        !pago.anulado && (
          <div className="flex gap-2">
            <button type="button" className="btn btn-peligro px-4" onClick={anular}>
              <Undo2 size={18} /> Anular
            </button>
            <button type="button" className="btn btn-primario flex-1" onClick={compartirResumen}>
              <Share2 size={18} /> Compartir
            </button>
          </div>
        )
      }
    >
      {!pago ? (
        <p className="py-10 text-center text-tinta-3">Este pago ya no existe.</p>
      ) : (
        <>
          <div className="rounded-3xl bg-superficie-2 p-4">
            <p className="num text-3xl font-extrabold">{pesos(pago.total_neto)}</p>
            <p className="num mt-1 text-sm text-tinta-2">
              Ganado {pesos(pago.total_bruto)}
              {pago.total_plus > 0 && ` · plus ${mas(pago.total_plus)}`}
              {pago.total_descuentos > 0 && ` · adelantos ${menos(pago.total_descuentos)}`}
            </p>
            {pago.nota && <p className="mt-2 text-sm text-tinta-2">“{pago.nota}”</p>}
          </div>
          <ul className="mt-3 divide-y divide-borde">
            {pago.items.map((i) => {
              const wa = whatsapp(i.telefono, reciboObrero({ hasta: pago.hasta, fecha: pago.fecha, item: i }));
              return (
                <li key={i.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{i.nombre}</p>
                    <p className="num truncate text-xs text-tinta-3">
                      {jornales(i.jornales)} j × {pesos(i.jornal)}
                      {i.plus > 0 && ` · ${mas(i.plus)}`}
                      {i.descuento > 0 && ` · adel. ${menos(i.descuento)}`}
                    </p>
                  </div>
                  <span className="num font-bold">{pesos(i.neto)}</span>
                  {wa ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Mandar recibo a ${i.nombre}`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ok-suave text-ok"
                    >
                      <MessageCircle size={17} />
                    </a>
                  ) : (
                    <span className="w-9 shrink-0" />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Hoja>
  );
}
