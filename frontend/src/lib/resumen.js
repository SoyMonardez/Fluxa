// Textos para compartir por WhatsApp (resumen del pago y recibo de cada obrero).
import { conDia, corta, semanaDePago } from './fechas';
import { jornales, pesos } from './formato';

export function resumenPago({ hasta, fecha, items, total }) {
  const semana = semanaDePago(hasta);
  const lineas = items.map((i) => {
    const extras = [i.plus > 0 ? `+ plus ${pesos(i.plus)}` : '', i.descuento > 0 ? `− adel. ${pesos(i.descuento)}` : ''].filter(Boolean).join(' ');
    return `• ${i.nombre}: ${jornales(i.jornales)} j → ${pesos(i.bruto)}${extras ? ` ${extras}` : ''} = *${pesos(i.neto)}*`;
  });
  return [
    `*ETEM · Pago del ${conDia(fecha)}*`,
    `Semana ${corta(semana.desde)} al ${corta(semana.hasta)}`,
    '',
    ...lineas,
    '',
    `*TOTAL: ${pesos(total)}* (${items.length} obreros)`,
  ].join('\n');
}

export function reciboObrero({ hasta, fecha, item }) {
  const semana = semanaDePago(hasta);
  const dias = (item.asistencias || []).map((a) => (a.jornales == null ? conDia(a.fecha) : `${conDia(a.fecha)} ${jornales(a.jornales)}`)).join(' · ');
  return [
    '*ETEM · Recibo de pago*',
    `${item.nombre} — ${item.rol ?? ''}`.trim(),
    `Pago del ${conDia(fecha)} (semana ${corta(semana.desde)} al ${corta(semana.hasta)})`,
    dias ? `Días: ${dias}` : '',
    `${jornales(item.jornales)} jornales × ${pesos(item.jornal)} = ${pesos(item.bruto)}`,
    item.plus > 0 ? `Plus: + ${pesos(item.plus)}` : '',
    item.descuento > 0 ? `Adelantos: − ${pesos(item.descuento)}` : '',
    `*Cobra: ${pesos(item.neto)}*`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Comparte con el menú del celular; si no hay, copia al portapapeles. Devuelve 'compartido' | 'copiado'. */
export async function compartir(texto) {
  if (navigator.share) {
    try {
      await navigator.share({ text: texto });
      return 'compartido';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelado';
    }
  }
  await navigator.clipboard.writeText(texto);
  return 'copiado';
}
