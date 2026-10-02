// F3: anotar un adelanto en segundos, viendo si le alcanza.
import { useState } from 'react';
import { darAdelanto, borrarAdelanto } from '../../lib/acciones';
import { avisar, avisarError } from '../../lib/avisos';
import { cuentaRapida } from '../../lib/derivados';
import { hoy } from '../../lib/fechas';
import { miles, pesos, primerNombre } from '../../lib/formato';
import { cerrar } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import { vibrar } from '../../lib/vibrar';
import { MontoInput } from '../../ui/campos';
import Hoja from '../../ui/Hoja';

const ATAJOS = [5000, 10000, 20000, 50000];

export default function HojaAdelanto({ obreroId }) {
  const o = useEstado((s) => s.obreros.find((x) => x.id === obreroId));
  const [monto, setMonto] = useState(0);
  const [fecha, setFecha] = useState(hoy);
  const [nota, setNota] = useState('');

  if (!o) return <Hoja titulo="Adelanto" />;
  const { lleva, deuda, queda } = cuentaRapida(o);

  function guardar() {
    if (!monto) return;
    try {
      const a = darAdelanto(o.id, monto, fecha, nota);
      vibrar(12);
      cerrar();
      avisar(`Adelanto de ${pesos(monto)} a ${primerNombre(o.nombre)}`, {
        accion: {
          texto: 'Deshacer',
          fn: () => {
            try {
              borrarAdelanto(a.id);
              avisar('Adelanto borrado');
            } catch (e) {
              avisarError(e);
            }
          },
        },
      });
    } catch (e) {
      avisarError(e);
    }
  }

  return (
    <Hoja
      titulo={`Adelanto a ${o.nombre}`}
      subtitulo={
        <>
          Lleva <b className="num">{pesos(lleva)}</b>
          {deuda > 0 && (
            <>
              {' '}
              · ya pidió <b className="num text-deuda">{pesos(deuda)}</b>
            </>
          )}{' '}
          · le queda <b className="num">{pesos(queda)}</b>
        </>
      }
      pie={
        <button type="button" className="btn btn-primario w-full" disabled={!monto} onClick={guardar}>
          {monto ? `Anotar adelanto de ${pesos(monto)}` : 'Escribí el monto'}
        </button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <MontoInput valor={monto} onCambio={setMonto} autoFocus />
        <div className="mt-3 grid grid-cols-4 gap-2">
          {ATAJOS.map((v) => (
            <button key={v} type="button" onClick={() => setMonto((x) => x + v)} className="btn btn-suave h-10 min-h-0 px-0 text-sm">
              +{miles(v)}
            </button>
          ))}
        </div>
        {monto > 0 && monto > queda && (
          <p className="mt-3 rounded-2xl bg-deuda-suave px-3 py-2.5 text-sm text-deuda">
            Es más de lo que le queda por cobrar ({pesos(queda)}). Se puede anotar igual: lo que sobre se descuenta en los próximos pagos.
          </p>
        )}
        <div className="mt-4 grid grid-cols-[auto_1fr] gap-3">
          <div>
            <label htmlFor="fecha-adelanto" className="etiqueta">
              Fecha
            </label>
            <input id="fecha-adelanto" type="date" className="campo" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value || hoy())} />
          </div>
          <div>
            <label htmlFor="nota-adelanto" className="etiqueta">
              Nota
            </label>
            <input id="nota-adelanto" className="campo" value={nota} maxLength={255} onChange={(e) => setNota(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
      </form>
    </Hoja>
  );
}
