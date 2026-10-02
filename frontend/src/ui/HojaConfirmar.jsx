import { useState } from 'react';
import { avisarError } from '../lib/avisos';
import { cerrar } from '../lib/hojas';
import Hoja from './Hoja';

/**
 * Confirmación genérica. onConfirmar puede devolver cuántas hojas cerrar
 * (por defecto 1: ésta).
 */
export default function HojaConfirmar({ titulo, texto, confirmar = 'Confirmar', peligro = false, onConfirmar }) {
  const [enviando, setEnviando] = useState(false);

  async function aceptar() {
    setEnviando(true);
    try {
      const n = await onConfirmar();
      cerrar(typeof n === 'number' ? n : 1);
    } catch (e) {
      avisarError(e);
      setEnviando(false);
    }
  }

  return (
    <Hoja
      titulo={titulo}
      pie={
        <div className="flex gap-2">
          <button type="button" className="btn btn-suave flex-1" onClick={() => cerrar()}>
            Cancelar
          </button>
          <button type="button" className={`btn flex-1 ${peligro ? 'bg-mal text-white' : 'btn-primario'}`} disabled={enviando} onClick={aceptar}>
            {enviando ? 'Un momento…' : confirmar}
          </button>
        </div>
      }
    >
      <div className="text-[15px] leading-relaxed text-tinta-2">{texto}</div>
    </Hoja>
  );
}
