// Un obrero dentro del próximo pago. Cerrado: días y monto. Abierto: descuento y plus.
import { AnimatePresence, m } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';
import { diasDesde, inicial } from '../../lib/fechas';
import { jornales, menos, pesos } from '../../lib/formato';
import { abrir } from '../../lib/hojas';
import Avatar from '../../ui/Avatar';
import { MontoInput, Renglon, Segmentos } from '../../ui/campos';

export default function ItemPago({ it, semana, color, abierto, onAbrir, onAjuste }) {
  const dias = diasDesde(semana.desde);
  const porFecha = new Map(it.asistencias.map((a) => [a.fecha, a.jornales]));
  const anteriores = it.asistencias.filter((a) => a.fecha < semana.desde).length;

  return (
    <li className="transition-opacity" style={{ opacity: it.incluir ? 1 : 0.5 }}>
      <div className="flex items-center gap-2.5 py-3 pr-3 pl-3">
        <button type="button" onClick={onAbrir} aria-expanded={abierto} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Avatar nombre={it.nombre} color={color} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="flex min-w-0 flex-1 items-center gap-1 text-[15px] font-semibold">
                <span className="truncate">{it.nombre}</span>
                <m.span animate={{ rotate: abierto ? 180 : 0 }} className="shrink-0 text-tinta-3">
                  <ChevronDown size={16} />
                </m.span>
              </p>
              <span className="num shrink-0 text-[17px] leading-tight font-extrabold">{pesos(it.neto)}</span>
            </div>
            <div className="mt-1 flex items-center gap-[3px]">
              {dias.map((d) => (
                <CeldaDia key={d} valor={porFecha.get(d)} letra={inicial(d)} />
              ))}
              {anteriores > 0 && <span className="chip ml-1 bg-info-suave px-1.5 text-[10px] text-info">+{anteriores} ant.</span>}
              <span className="ml-auto truncate pl-2 text-xs font-semibold">
                {it.descuento > 0 ? (
                  <span className="num text-deuda">{menos(it.descuento)}</span>
                ) : it.deuda > 0 ? (
                  <span className="text-tinta-3">adel. después</span>
                ) : (
                  <span className="num font-normal text-tinta-3">{jornales(it.jornales)} j</span>
                )}
              </span>
            </div>
          </div>
        </button>
        <button
          type="button"
          role="checkbox"
          aria-checked={it.incluir}
          aria-label={`Incluir a ${it.nombre} en este pago`}
          onClick={() => onAjuste({ incluir: !it.incluir })}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-[0.6rem] border-2 transition-colors ${it.incluir ? 'border-tinta bg-tinta text-superficie' : 'border-borde'}`}
        >
          {it.incluir && <Check size={18} strokeWidth={3} />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {abierto && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="overflow-hidden"
          >
            <Detalle it={it} onAjuste={onAjuste} />
          </m.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function CeldaDia({ valor, letra }) {
  if (!valor) {
    return <span className="grid h-[18px] w-[18px] place-items-center rounded-[5px] border border-borde text-[9px] font-bold text-tinta-3">{letra}</span>;
  }
  return (
    <span className={`grid h-[18px] w-[18px] place-items-center rounded-[5px] text-[9px] font-extrabold text-white ${valor === 1 ? 'bg-ok' : 'bg-info'}`}>
      {valor === 1 ? letra : jornales(valor)}
    </span>
  );
}

function Detalle({ it, onAjuste }) {
  return (
    <div className="mx-3 mb-3 space-y-3 rounded-2xl bg-superficie-2 p-3 text-[15px]">
      <Renglon texto={`${jornales(it.jornales)} jornales × ${pesos(it.jornal)}`} valor={pesos(it.bruto)} />

      {it.deuda > 0 && (
        <div>
          <Renglon texto="Adelantos pendientes" valor={<span className="text-deuda">{pesos(it.deuda)}</span>} />
          <Segmentos
            id={`desc-${it.obrero_id}`}
            className="mt-1.5"
            fondo="bg-superficie"
            pildora="bg-tinta [&+span]:text-superficie"
            valor={it.modo}
            onCambio={(modo) => onAjuste({ modo, ...(modo === 'parte' && !it.monto ? { monto: Math.round(it.tope / 2) } : {}) })}
            opciones={[
              { valor: 'todo', texto: 'Descontar' },
              { valor: 'parte', texto: 'Una parte' },
              { valor: 'nada', texto: 'Después' },
            ]}
          />
          {it.modo === 'parte' && (
            <div className="mt-2">
              <MontoInput valor={it.monto} onCambio={(monto) => onAjuste({ monto })} tam="chico" />
              <p className="mt-1 text-xs text-tinta-3">Máximo {pesos(it.tope)}. Lo que no se descuente queda para el próximo pago.</p>
            </div>
          )}
          {it.modo === 'nada' && <p className="mt-1.5 text-xs text-tinta-3">Los {pesos(it.deuda)} quedan pendientes para otro pago.</p>}
        </div>
      )}

      <div>
        <span className="etiqueta">Plus (un poco más esta semana)</span>
        <div className="grid grid-cols-[1fr_1.2fr] gap-2">
          <MontoInput valor={it.plus} onCambio={(plus) => onAjuste({ plus })} tam="chico" />
          <input className="campo py-2" value={it.nota} maxLength={255} onChange={(e) => onAjuste({ nota: e.target.value })} placeholder="Motivo (opcional)" />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-borde pt-2.5">
        <button type="button" onClick={() => abrir('ficha', { obreroId: it.obrero_id })} className="text-sm font-semibold text-marca">
          Ver ficha
        </button>
        <span className="text-right">
          <span className="block text-xs text-tinta-3">Cobra</span>
          <span className="num text-xl font-extrabold">{pesos(it.neto)}</span>
        </span>
      </div>
    </div>
  );
}
