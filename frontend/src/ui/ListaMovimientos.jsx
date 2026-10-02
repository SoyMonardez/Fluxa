import { corta } from '../lib/fechas';
import { pesos } from '../lib/formato';
import { describir } from '../lib/movimientos';

/** Historial de herramientas. conHerramienta: muestra el nombre de la herramienta en cada fila. */
export default function ListaMovimientos({ movimientos, cuadrillaId = null, conHerramienta = true }) {
  if (!movimientos) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="esqueleto h-12" />
        ))}
      </div>
    );
  }
  if (!movimientos.length) return <p className="py-4 text-center text-sm text-tinta-3">Sin movimientos todavía.</p>;
  return (
    <ul className="space-y-1">
      {movimientos.map((m) => {
        const d = describir(m, cuadrillaId);
        return (
          <li key={m.id} className="flex items-start gap-3 py-1.5">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${d.tono}`}>
              <d.icono size={15} />
            </span>
            <div className="min-w-0 flex-1 text-sm leading-snug">
              <p>
                <b>{d.titulo}</b> · {m.cantidad} {conHerramienta ? `× ${m.herramienta}` : m.cantidad === 1 ? 'unidad' : 'unidades'}
                {d.lugar && <span className="text-tinta-2"> {d.lugar}</span>}
              </p>
              <p className="text-xs text-tinta-3">
                {corta(m.fecha)}
                {m.responsable_nombre && ` · responde ${m.responsable_nombre}`}
                {m.cargo > 0 && <span className="font-semibold text-deuda"> · cobrado {pesos(m.cargo)}</span>}
                {m.nota && ` · ${m.nota}`}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
