// F2: medio día, jornal, medio día más o doble jornada (+ nota del día).
import { useState } from 'react';
import { Check, Lock, X } from 'lucide-react';
import { marcar } from '../../lib/acciones';
import { larga } from '../../lib/fechas';
import { JORNADAS, pesos } from '../../lib/formato';
import { cerrar } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import { vibrar } from '../../lib/vibrar';
import Hoja from '../../ui/Hoja';

const ESTILO = {
  0: 'bg-mal-suave text-mal',
  1: 'bg-ok-suave text-ok',
};

export default function HojaJornada({ obreroId, fecha }) {
  const o = useEstado((s) => s.obreros.find((x) => x.id === obreroId));
  const registro = useEstado((s) => s.asistencia[fecha]?.[obreroId]);
  const [nota, setNota] = useState(registro?.nota ?? '');
  const actual = registro?.jornales ?? 0;
  const pagado = Boolean(registro?.pagado);

  function elegir(valor) {
    vibrar(10);
    cerrar();
    marcar(obreroId, fecha, valor, nota.trim());
  }

  const dia = larga(fecha);
  return (
    <Hoja titulo={o?.nombre ?? 'Jornada'} subtitulo={`${dia[0].toUpperCase()}${dia.slice(1)} · jornal ${pesos(o?.jornal)}`}>
      {pagado && (
        <p className="mb-3 flex items-center gap-2 rounded-2xl bg-superficie-2 p-3 text-sm text-tinta-2">
          <Lock size={16} className="shrink-0" /> Este día ya se pagó. Para cambiarlo, anulá el pago en Pagos → Historial.
        </p>
      )}
      <div className="space-y-2">
        {JORNADAS.map((j) => {
          const activo = actual === j.valor;
          return (
            <button
              key={j.valor}
              type="button"
              disabled={pagado}
              onClick={() => elegir(j.valor)}
              className={`flex w-full items-center gap-3.5 rounded-2xl border px-3.5 py-2.5 text-left transition-colors active:scale-[0.99] disabled:opacity-50 ${
                activo ? 'border-tinta bg-superficie-2' : 'border-borde'
              }`}
            >
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg font-extrabold ${ESTILO[j.valor] ?? 'bg-info-suave text-info'}`}>
                {j.valor === 0 ? <X size={20} strokeWidth={2.8} /> : j.corto}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{j.largo}</span>
                <span className="text-sm text-tinta-3">{j.valor ? `${j.corto} jornal${j.valor > 1 ? 'es' : ''}` : 'Ese día no se paga'}</span>
              </span>
              <span className="num shrink-0 font-bold">{j.valor ? pesos(j.valor * (o?.jornal ?? 0)) : '—'}</span>
              <span className="w-5 shrink-0">{activo && <Check size={20} strokeWidth={2.8} />}</span>
            </button>
          );
        })}
      </div>
      <label htmlFor="nota-jornada" className="etiqueta mt-4">
        Nota del día (opcional)
      </label>
      <input
        id="nota-jornada"
        className="campo"
        value={nota}
        disabled={pagado}
        maxLength={255}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Ej: se quedó a hormigonar"
      />
      <p className="mt-2 text-xs text-tinta-3">Si querés dejar una nota, escribila primero y después tocá la jornada.</p>
    </Hoja>
  );
}
