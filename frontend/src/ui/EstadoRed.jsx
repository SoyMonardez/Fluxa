// Indicador de sincronización del encabezado. No se ve si todo está subido y hay
// señal; si no, muestra qué pasa (sin señal, subiendo, error) y abre el menú.
import { CloudAlert, CloudOff, CloudUpload, KeyRound } from 'lucide-react';
import { abrir } from '../lib/hojas';
import { useEstado } from '../lib/store';

export default function EstadoRed() {
  const red = useEstado((s) => s.red);
  const pendientes = useEstado((s) => s.pendientes);
  const enLinea = useEstado((s) => s.enLinea);

  let icono;
  let etiqueta;
  let tono = 'text-tinta-3';
  if (red === 'sesion') {
    icono = KeyRound;
    etiqueta = 'La sesión venció';
    tono = 'text-mal';
  } else if (pendientes > 0 && red === 'subiendo') {
    icono = CloudUpload;
    etiqueta = `Subiendo ${pendientes} cambio${pendientes === 1 ? '' : 's'}`;
    tono = 'text-info animate-pulse';
  } else if (red === 'error') {
    icono = CloudAlert;
    etiqueta = 'No se pudo sincronizar';
    tono = 'text-mal';
  } else if (pendientes > 0) {
    icono = CloudOff;
    etiqueta = `${pendientes} cambio${pendientes === 1 ? '' : 's'} guardado${pendientes === 1 ? '' : 's'} en el teléfono, esperando señal`;
    tono = 'text-deuda';
  } else if (!enLinea || red === 'sin-senal') {
    icono = CloudOff;
    etiqueta = 'Sin señal: lo que hagas queda guardado en el teléfono';
  } else {
    return null;
  }
  const Icono = icono;

  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={() => abrir('menu')}
      className={`animar-aparecer relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform active:scale-90 ${tono}`}
    >
      <Icono size={21} />
      {pendientes > 0 && (
        <span className="num absolute top-0.5 right-0 grid h-4 min-w-4 place-items-center rounded-full bg-deuda px-1 text-[10px] font-bold text-white">
          {pendientes > 99 ? '99+' : pendientes}
        </span>
      )}
    </button>
  );
}
