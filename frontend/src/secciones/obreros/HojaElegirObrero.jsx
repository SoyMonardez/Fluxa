// Elegir un obrero (con buscador) y seguir a otra hoja, ej. adelanto.
import { useMemo, useState } from 'react';
import { buscar, cuentaRapida } from '../../lib/derivados';
import { pesos } from '../../lib/formato';
import { reemplazar } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import Avatar from '../../ui/Avatar';
import { Buscador } from '../../ui/campos';
import Hoja from '../../ui/Hoja';

export default function HojaElegirObrero({ titulo = 'Elegí un obrero', siguiente }) {
  const obreros = useEstado((s) => s.obreros);
  const cuadrillas = useEstado((s) => s.cuadrillas);
  const [texto, setTexto] = useState('');

  const lista = useMemo(
    () => obreros.filter((o) => o.activo && buscar(texto, o.nombre, o.rol)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [obreros, texto]
  );
  const colorDe = (o) => cuadrillas.find((c) => c.id === o.cuadrilla_id)?.color;

  return (
    <Hoja titulo={titulo} completo>
      <div className="sticky top-0 z-10 -mx-5 bg-superficie px-5 pb-3">
        <Buscador valor={texto} onCambio={setTexto} placeholder="Buscar por nombre" />
      </div>
      <ul className="divide-y divide-borde">
        {lista.map((o) => {
          const { queda, deuda } = cuentaRapida(o);
          return (
            <li key={o.id}>
              <button type="button" onClick={() => reemplazar(siguiente, { obreroId: o.id })} className="flex w-full items-center gap-3 py-2.5 text-left active:opacity-70">
                <Avatar nombre={o.nombre} color={colorDe(o)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{o.nombre}</p>
                  <p className="truncate text-[13px] text-tinta-2">
                    {o.rol}
                    {deuda > 0 && <span className="text-deuda"> · adel. {pesos(deuda)}</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num font-bold">{pesos(queda)}</p>
                  <p className="text-[11px] text-tinta-3">le queda</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {!lista.length && <p className="py-10 text-center text-tinta-3">Nadie coincide con “{texto}”.</p>}
    </Hoja>
  );
}
