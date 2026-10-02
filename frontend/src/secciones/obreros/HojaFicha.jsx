// Ficha del obrero: cuánto lleva, cuánto debe, cuánto le queda; días, adelantos y pagos.
import { useState } from 'react';
import { HandCoins, Lock, MessageCircle, Pencil, Phone, Trash2, Wrench } from 'lucide-react';
import { borrarAdelanto } from '../../lib/acciones';
import { avisar } from '../../lib/avisos';
import { useCuenta } from '../../lib/consultas';
import { cuentaRapida } from '../../lib/derivados';
import { conDia, corta } from '../../lib/fechas';
import { colorDe, jornales, mas, menos, pesos, whatsapp } from '../../lib/formato';
import { abrir } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import Avatar from '../../ui/Avatar';
import { Numero, Segmentos } from '../../ui/campos';
import Hoja, { BotonCerrar } from '../../ui/Hoja';

export default function HojaFicha({ obreroId }) {
  const o = useEstado((s) => s.obreros.find((x) => x.id === obreroId));
  const cuadrilla = useEstado((s) => s.cuadrillas.find((c) => c.id === o?.cuadrilla_id));
  const cuenta = useCuenta(obreroId);
  const [pestana, setPestana] = useState('dias');

  if (!o) return <Hoja titulo="Obrero" />;

  const { lleva, deuda, queda } = cuentaRapida(o);
  const encargado = cuadrilla?.encargado_id === o.id;
  const wa = whatsapp(o.telefono);

  const cabecera = (
    <div className="flex items-start gap-3 px-5 pt-3 pb-2">
      <Avatar nombre={o.nombre} color={cuadrilla?.color} tam={56} encargado={encargado} apagado={!o.activo} />
      <div className="min-w-0 flex-1 pt-0.5">
        <h2 className="text-xl leading-tight font-extrabold">{o.nombre}</h2>
        <p className="mt-0.5 text-sm text-tinta-2">
          {o.rol} · <b className="num text-tinta">{pesos(o.jornal)}</b> por día
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {cuadrilla ? (
            <span className="chip bg-superficie-2 text-tinta-2">
              <span className="h-2 w-2 rounded-full" style={{ background: colorDe(cuadrilla.color) }} />
              {cuadrilla.nombre}
              {encargado && ' · encargado'}
            </span>
          ) : (
            <span className="chip bg-superficie-2 text-tinta-3">Sin cuadrilla</span>
          )}
          {!o.activo && <span className="chip bg-mal-suave text-mal">Dado de baja</span>}
        </div>
      </div>
      <BotonCerrar />
    </div>
  );

  return (
    <Hoja completo titulo={o.nombre} cabecera={cabecera}>
      <div className="flex gap-2 pb-4">
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="btn btn-suave h-11 min-h-0 flex-1 px-2 text-sm">
            <MessageCircle size={18} /> WhatsApp
          </a>
        )}
        {o.telefono && (
          <a href={`tel:${o.telefono}`} className="btn btn-suave h-11 min-h-0 flex-1 px-2 text-sm">
            <Phone size={18} /> Llamar
          </a>
        )}
        <button type="button" onClick={() => abrir('obreroForm', { obreroId: o.id })} className="btn btn-suave h-11 min-h-0 flex-1 px-2 text-sm">
          <Pencil size={17} /> Editar
        </button>
      </div>

      <div className="rounded-3xl bg-superficie-2 p-4">
        <p className="text-xs font-bold tracking-wide text-tinta-3 uppercase">Cuenta para el viernes</p>
        <div className="mt-2 space-y-1.5 text-[15px]">
          <div className="flex justify-between gap-3">
            <span className="text-tinta-2">
              Lleva ganado{o.pend_dias ? ` (${jornales(o.pend_jornales)} jornales sin pagar)` : ''}
            </span>
            <Numero valor={lleva} className="font-semibold" />
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-tinta-2">Adelantos y cargos pendientes</span>
            <span className={`num font-semibold ${deuda ? 'text-deuda' : ''}`}>{deuda ? menos(deuda) : pesos(0)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-borde pt-2">
            <span className="font-bold">Le queda</span>
            <Numero valor={queda} className={`text-2xl font-extrabold ${queda < 0 ? 'text-mal' : ''}`} />
          </div>
          {queda < 0 && <p className="text-xs text-mal">Pidió más de lo que lleva ganado: lo que falte se descuenta en los próximos pagos.</p>}
        </div>
        {o.activo && (
          <button type="button" onClick={() => abrir('adelanto', { obreroId: o.id })} className="btn btn-primario mt-3 w-full">
            <HandCoins size={20} /> Dar adelanto
          </button>
        )}
      </div>

      <Segmentos
        className="mt-5"
        valor={pestana}
        onCambio={setPestana}
        opciones={[
          { valor: 'dias', texto: 'Días' },
          { valor: 'adelantos', texto: 'Adelantos' },
          { valor: 'pagos', texto: 'Pagos' },
        ]}
      />

      <div key={pestana} className="animar-subir mt-3">
        {pestana === 'dias' ? (
          <ListaDias asistencias={cuenta.asistencias} jornal={o.jornal} />
        ) : pestana === 'adelantos' ? (
          <ListaAdelantos adelantos={cuenta.adelantos} />
        ) : (
          <ListaPagos pagos={cuenta.pagos} />
        )}
      </div>
    </Hoja>
  );
}

// Lo pagado se ve en "Pagos" (con el jornal de ese momento); acá, lo que lleva sin cobrar.
function ListaDias({ asistencias, jornal }) {
  if (!asistencias.length) return <p className="py-6 text-center text-sm text-tinta-3">Sin días registrados en los últimos meses.</p>;
  return (
    <ul className="divide-y divide-borde rounded-2xl border border-borde">
      {asistencias.map((a) => (
        <li key={a.fecha} className="flex items-center gap-3 px-3 py-2.5">
          <span className="w-20 shrink-0 text-sm font-semibold capitalize">{conDia(a.fecha)}</span>
          <span className={`chip ${a.jornales === 1 ? 'bg-ok-suave text-ok' : 'bg-info-suave text-info'}`}>
            {jornales(a.jornales)} {a.jornales > 1 ? 'jornales' : 'jornal'}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-tinta-3">{a.nota}</span>
          {!a.pagado && <span className="num text-sm font-semibold">{pesos(a.jornales * jornal)}</span>}
          {a.pagado ? <Lock size={14} className="shrink-0 text-tinta-3" aria-label="Pagado" /> : <span className="w-3.5 shrink-0" />}
        </li>
      ))}
    </ul>
  );
}

function ListaAdelantos({ adelantos }) {
  if (!adelantos.length) return <p className="py-6 text-center text-sm text-tinta-3">No pidió adelantos.</p>;

  function borrar(a) {
    abrir('confirmar', {
      titulo: 'Borrar adelanto',
      texto: `¿Borrar el ${a.tipo === 'cargo' ? 'cargo' : 'adelanto'} de ${pesos(a.monto)} del ${conDia(a.fecha)}?`,
      confirmar: 'Borrar',
      peligro: true,
      onConfirmar: () => {
        borrarAdelanto(a.id);
        avisar('Borrado');
      },
    });
  }

  return (
    <ul className="divide-y divide-borde rounded-2xl border border-borde">
      {adelantos.map((a) => {
        const estado = a.pendiente === 0 ? 'Descontado' : a.descontado > 0 ? `Falta ${pesos(a.pendiente)}` : 'Pendiente';
        return (
          <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${a.tipo === 'cargo' ? 'bg-mal-suave text-mal' : 'bg-deuda-suave text-deuda'}`}>
              {a.tipo === 'cargo' ? <Wrench size={17} /> : <HandCoins size={17} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="num font-semibold">
                {pesos(a.monto)} <span className="text-sm font-normal text-tinta-3">· {corta(a.fecha)}</span>
              </p>
              <p className="truncate text-xs text-tinta-3">{a.nota || (a.tipo === 'cargo' ? 'Cargo por herramienta' : 'Adelanto')}</p>
            </div>
            <span className={`chip ${a.pendiente === 0 ? 'bg-superficie-2 text-tinta-3' : 'bg-deuda-suave text-deuda'}`}>{estado}</span>
            {a.descontado === 0 && (
              <button type="button" aria-label="Borrar" onClick={() => borrar(a)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-tinta-3 active:bg-superficie-2">
                <Trash2 size={17} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ListaPagos({ pagos }) {
  if (!pagos.length) return <p className="py-6 text-center text-sm text-tinta-3">Todavía no cobró ningún pago.</p>;
  return (
    <ul className="divide-y divide-borde rounded-2xl border border-borde">
      {pagos.map((p) => (
        <li key={p.pago_id}>
          <button type="button" onClick={() => abrir('detallePago', { pagoId: p.pago_id })} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
            <div className="min-w-0 flex-1">
              <p className="font-semibold capitalize">{conDia(p.fecha)}</p>
              <p className="num truncate text-xs text-tinta-3">
                {jornales(p.jornales)} j × {pesos(p.jornal)}
                {p.descuento > 0 && ` · adel. ${menos(p.descuento)}`}
                {p.plus > 0 && ` · plus ${mas(p.plus)}`}
              </p>
            </div>
            <span className="num font-bold">{pesos(p.neto)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
