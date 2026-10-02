// Consultas de las hojas (ficha, pagos, movimientos) sobre las tablas del teléfono.
// Se recalculan solas cuando cambia algo, sin pedir nada al servidor.
import { useMemo } from 'react';
import { previewPago } from '../motor/calculos';
import { cuentaObrero, detallePago, listaPagos, movimientosDe } from '../motor/derivar';
import { useEstado } from './store';

const useTablas = () => useEstado((s) => s.tablas);

export function useCuenta(obreroId) {
  const t = useTablas();
  return useMemo(() => cuentaObrero(t, obreroId), [t, obreroId]);
}

export function usePagos() {
  const t = useTablas();
  return useMemo(() => listaPagos(t), [t]);
}

export function useDetallePago(pagoId) {
  const t = useTablas();
  return useMemo(() => detallePago(t, pagoId), [t, pagoId]);
}

export function useMovimientos({ herramientaId = null, cuadrillaId = null, limite = 40 }) {
  const t = useTablas();
  return useMemo(() => movimientosDe(t, { herramientaId, cuadrillaId, limite }), [t, herramientaId, cuadrillaId, limite]);
}

export function usePreviewPago(hasta) {
  const t = useTablas();
  return useMemo(() => previewPago(t, hasta), [t, hasta]);
}
