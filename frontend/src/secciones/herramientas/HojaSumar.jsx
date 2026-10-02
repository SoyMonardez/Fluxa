// Sumar unidades al inventario (compra, apareció la que faltaba, se arregló).
import { useState } from 'react';
import { sumarUnidades } from '../../lib/acciones';
import { avisar, avisarError } from '../../lib/avisos';
import { cerrar } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import { Contador } from '../../ui/campos';
import Hoja from '../../ui/Hoja';

const MOTIVOS = ['Compra', 'Apareció', 'Se arregló'];

export default function HojaSumar({ herramientaId }) {
  const h = useEstado((s) => s.herramientas.find((x) => x.id === herramientaId));
  const [n, setN] = useState(1);
  const [motivo, setMotivo] = useState('Compra');
  if (!h) return <Hoja titulo="Sumar unidades" />;

  function sumar() {
    try {
      sumarUnidades(h.id, n, motivo);
      avisar(`+${n} ${h.nombre} en el pañol`);
      cerrar();
    } catch (e) {
      avisarError(e);
    }
  }

  return (
    <Hoja
      titulo={`Sumar ${h.nombre}`}
      subtitulo={`Ahora hay ${h.cantidad}. Las nuevas quedan en el pañol.`}
      pie={
        <button type="button" className="btn btn-primario w-full" onClick={sumar}>
          Sumar {n} (quedan {h.cantidad + n})
        </button>
      }
    >
      <div className="flex items-center justify-between rounded-2xl bg-superficie-2 p-3">
        <span className="font-semibold">Cantidad</span>
        <Contador valor={n} min={1} max={10000} onCambio={setN} />
      </div>
      <p className="etiqueta mt-4">Motivo</p>
      <div className="flex flex-wrap gap-2">
        {MOTIVOS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMotivo(m)}
            className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${motivo === m ? 'border-tinta bg-superficie-2' : 'border-borde text-tinta-2'}`}
          >
            {m}
          </button>
        ))}
      </div>
    </Hoja>
  );
}
