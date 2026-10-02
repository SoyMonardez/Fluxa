// Cálculo del próximo pago: por obrero, días × jornal, descuento de adelantos
// (todo, nada o una parte) y plus. Abajo, el total y el botón para pagar.
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CircleAlert, PartyPopper } from 'lucide-react';
import { previewPago } from '../../lib/acciones';
import { avisarError } from '../../lib/avisos';
import { conDia, corta, nombreDia, rango, semanaDePago, sumarDias } from '../../lib/fechas';
import { useHoy } from '../../lib/useHoy';
import { jornales, mas, menos, pesos } from '../../lib/formato';
import { abrir } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import { Numero, Vacio } from '../../ui/campos';
import { Esqueleto } from '../../ui/pagina';
import ItemPago from './ItemPago';

const suma = (lista, k) => lista.reduce((s, x) => s + (Number(x[k]) || 0), 0);

export default function ProximoPago() {
  const corteActual = semanaDePago(useHoy()).hasta;
  // null = el viernes de esta semana (se actualiza solo al cambiar de semana)
  const [elegido, setElegido] = useState(null);
  const hasta = elegido ?? corteActual;
  const setHasta = (f) => setElegido(f === corteActual ? null : f);
  const [datos, setDatos] = useState(null);
  const [ajustes, setAjustes] = useState({ clave: null, v: {} });
  const [abierto, setAbierto] = useState(null);
  const version = useEstado((s) => s.version);
  const deudaVersion = useEstado((s) => s.obreros.reduce((t, o) => t + o.deuda, 0));
  const cuadrillas = useEstado((s) => s.cuadrillas);
  const obreros = useEstado((s) => s.obreros);

  // Se recalcula con otro corte, después de un pago o si cambian los adelantos.
  // Lo que ajustaste a mano (descuentos, plus) se mantiene mientras no cambie el corte.
  const claveDatos = `${hasta}|${version}|${deudaVersion}`;
  const clave = `${hasta}|${version}`;
  useEffect(() => {
    let vivo = true;
    previewPago(hasta)
      .then((d) => vivo && setDatos(d))
      .catch((e) => vivo && avisarError(e));
    return () => {
      vivo = false;
    };
  }, [hasta, claveDatos]);

  const listo = datos?.hasta === hasta;
  const semana = useMemo(() => semanaDePago(hasta), [hasta]);
  const valores = ajustes.clave === clave ? ajustes.v : null;

  const items = useMemo(
    () =>
      (listo ? datos.items : []).map((it) => {
        const a = valores?.[it.obrero_id] ?? {};
        const incluir = a.incluir ?? true;
        const plus = a.plus ?? 0;
        const tope = Math.max(0, Math.min(it.deuda, it.bruto + plus));
        const modo = a.modo ?? 'todo';
        const descuento = modo === 'todo' ? tope : modo === 'nada' ? 0 : Math.min(a.monto ?? 0, tope);
        return { ...it, incluir, plus, tope, modo, monto: a.monto ?? 0, descuento, neto: it.bruto + plus - descuento, nota: a.nota ?? '' };
      }),
    [listo, datos, valores]
  );

  function ajustar(obreroId, cambios) {
    setAjustes((prev) => {
      const v = prev.clave === clave ? prev.v : {};
      return { clave, v: { ...v, [obreroId]: { ...v[obreroId], ...cambios } } };
    });
  }

  const incluidos = items.filter((i) => i.incluir);
  const total = suma(incluidos, 'neto');
  const deudaQueda = items.reduce((s, i) => s + i.deuda - (i.incluir ? i.descuento : 0), 0) + suma(datos?.sin_dias ?? [], 'deuda');
  const conAnteriores = items.filter((i) => i.desde < semana.desde).length;
  const cuadrillaDe = (id) => cuadrillas.find((c) => c.id === obreros.find((o) => o.id === id)?.cuadrilla_id);

  function pagar() {
    abrir('confirmarPago', {
      hasta,
      items: incluidos,
      totales: {
        neto: total,
        bruto: suma(incluidos, 'bruto'),
        plus: suma(incluidos, 'plus'),
        descuento: suma(incluidos, 'descuento'),
        jornales: suma(incluidos, 'jornales'),
      },
      deudaQueda,
    });
  }

  return (
    <div className="pb-24">
      <div className="mt-3 flex items-center gap-2">
        <button type="button" aria-label="Semana anterior" onClick={() => setHasta(sumarDias(hasta, -7))} className="grid h-10 w-10 place-items-center rounded-full active:bg-superficie-2">
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="font-bold">
            Pago del {nombreDia(hasta)} {corta(hasta)}
          </p>
          <p className="text-[13px] text-tinta-3">Semana {rango(semana)}</p>
        </div>
        <button
          type="button"
          aria-label="Semana siguiente"
          disabled={hasta >= corteActual}
          onClick={() => setHasta(sumarDias(hasta, 7))}
          className="grid h-10 w-10 place-items-center rounded-full active:bg-superficie-2 disabled:opacity-25"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {!listo ? (
        <Esqueleto filas={5} />
      ) : !items.length ? (
        <Vacio icono={PartyPopper} titulo="No hay nada pendiente de pago" texto={`Todos los días hasta el ${conDia(hasta)} ya están pagados.`} />
      ) : (
        <>
          <div className="tarjeta mt-3 overflow-hidden">
            <div className="p-4 pb-3">
              <p className="text-xs font-bold tracking-wide text-tinta-3 uppercase">Total a pagar</p>
              <Numero valor={total} className="block text-[2.4rem] leading-tight font-extrabold tracking-tight" />
              <p className="num text-sm text-tinta-2">
                {incluidos.length} obreros · {jornales(suma(incluidos, 'jornales'))} jornales
              </p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-borde border-t border-borde bg-superficie-2 text-center">
              <Dato texto="Ganado" valor={pesos(suma(incluidos, 'bruto'))} />
              <Dato texto="Plus" valor={mas(suma(incluidos, 'plus'))} />
              <Dato texto="Adelantos" valor={menos(suma(incluidos, 'descuento'))} clase="text-deuda" />
            </div>
          </div>

          {conAnteriores > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-2xl bg-info-suave p-3 text-sm text-info">
              <CircleAlert size={18} className="mt-px shrink-0" />
              {conAnteriores === 1 ? 'Un obrero tiene' : `${conAnteriores} obreros tienen`} días sin pagar de semanas anteriores: se suman en este pago.
            </p>
          )}

          <p className="px-1 pt-5 pb-2 text-[13px] text-tinta-3">Tocá un obrero para descontar adelantos ahora o dejarlos para después, o para sumarle un plus.</p>
          <ul className="tarjeta divide-y divide-borde overflow-hidden">
            {items.map((it) => (
              <ItemPago
                key={it.obrero_id}
                it={it}
                semana={semana}
                color={cuadrillaDe(it.obrero_id)?.color}
                abierto={abierto === it.obrero_id}
                onAbrir={() => setAbierto((a) => (a === it.obrero_id ? null : it.obrero_id))}
                onAjuste={(c) => ajustar(it.obrero_id, c)}
              />
            ))}
          </ul>

          {datos.sin_dias.length > 0 && (
            <div className="mt-4 rounded-2xl border border-dashed border-borde p-3 text-sm text-tinta-2">
              <p className="font-semibold text-tinta">Con adelantos pero sin días para cobrar</p>
              {datos.sin_dias.map((x) => (
                <p key={x.obrero_id} className="num mt-1">
                  {x.nombre}: debe <b className="text-deuda">{pesos(x.deuda)}</b> (pasa al próximo pago)
                </p>
              ))}
            </div>
          )}

          <div className="fixed inset-x-0 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-30 px-4 md:bottom-6 md:left-64">
            <div className="mx-auto max-w-3xl">
              <button
                type="button"
                disabled={!incluidos.length}
                onClick={pagar}
                className="btn btn-primario h-14 w-full justify-between rounded-2xl px-5 text-base shadow-[0_12px_30px_-8px_rgb(0_0_0/0.45)]"
              >
                <span>Pagar a {incluidos.length}</span>
                <Numero valor={total} className="text-lg font-extrabold" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Dato({ texto, valor, clase = '' }) {
  return (
    <div className="px-1 py-2.5">
      <p className="text-[11px] font-semibold text-tinta-3">{texto}</p>
      <p className={`num truncate text-[13px] font-bold ${clase}`}>{valor}</p>
    </div>
  );
}
