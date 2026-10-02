// Cómo se cuenta cada movimiento de herramientas en el historial.
import { ArrowLeftRight, PackageMinus, PackagePlus, Pencil, Plus, ShieldAlert } from 'lucide-react';

const BASE = {
  alta: { icono: Plus, titulo: 'Alta en el pañol', tono: 'bg-superficie-2 text-tinta-2' },
  ajuste: { icono: Pencil, titulo: 'Baja manual', tono: 'bg-superficie-2 text-tinta-2' },
  entrega: { icono: PackagePlus, titulo: 'Entrega', tono: 'bg-ok-suave text-ok' },
  devolucion: { icono: PackageMinus, titulo: 'Devolución al pañol', tono: 'bg-superficie-2 text-tinta-2' },
  traslado: { icono: ArrowLeftRight, titulo: 'Traslado', tono: 'bg-info-suave text-info' },
  robo: { icono: ShieldAlert, titulo: 'Robo', tono: 'bg-mal-suave text-mal' },
  faltante: { icono: ShieldAlert, titulo: 'Faltante', tono: 'bg-mal-suave text-mal' },
  rotura: { icono: ShieldAlert, titulo: 'Rotura por mal uso', tono: 'bg-mal-suave text-mal' },
};

export const esReclamo = (tipo) => tipo === 'robo' || tipo === 'faltante' || tipo === 'rotura';

/** { icono, titulo, detalle, tono } — cuadrillaId: desde qué cuadrilla se mira (para "llegó de" / "se fue a"). */
export function describir(m, cuadrillaId = null) {
  const b = BASE[m.tipo] ?? BASE.ajuste;
  // Mirando una cuadrilla, no hace falta repetir su nombre.
  const aca = (id) => cuadrillaId != null && id === cuadrillaId;
  let lugar = '';
  if (m.tipo === 'entrega') lugar = aca(m.hacia_id) ? '' : `a ${m.hacia_nombre}`;
  else if (m.tipo === 'devolucion') lugar = aca(m.desde_id) ? '' : `desde ${m.desde_nombre}`;
  else if (m.tipo === 'traslado') {
    if (aca(m.hacia_id)) lugar = `desde ${m.desde_nombre}`;
    else if (aca(m.desde_id)) lugar = `a ${m.hacia_nombre}`;
    else lugar = `${m.desde_nombre} → ${m.hacia_nombre}`;
  } else if (esReclamo(m.tipo)) lugar = aca(m.desde_id) ? '' : m.desde_nombre ? `en ${m.desde_nombre}` : 'en el pañol';
  const titulo = m.tipo === 'traslado' && aca(m.hacia_id) ? 'Llegó' : m.tipo === 'traslado' && aca(m.desde_id) ? 'Se fue' : b.titulo;
  return { ...b, titulo, lugar };
}
