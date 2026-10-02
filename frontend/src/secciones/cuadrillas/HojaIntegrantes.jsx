// Elegir quiénes forman la cuadrilla. Si alguien estaba en otra, se lo mueve.
import { useMemo, useState } from 'react';
import { Check, UserPlus } from 'lucide-react';
import { definirIntegrantes } from '../../lib/acciones';
import { avisar, avisarError } from '../../lib/avisos';
import { buscar } from '../../lib/derivados';
import { colorDe, ordenRol } from '../../lib/formato';
import { abrir, cerrar } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import Avatar from '../../ui/Avatar';
import { Buscador } from '../../ui/campos';
import Hoja from '../../ui/Hoja';

export default function HojaIntegrantes({ cuadrillaId }) {
  const c = useEstado((s) => s.cuadrillas.find((x) => x.id === cuadrillaId));
  const cuadrillas = useEstado((s) => s.cuadrillas);
  const obreros = useEstado((s) => s.obreros);
  // Se guardan sólo los cambios, así un obrero nuevo creado desde acá no se pierde.
  const [cambios, setCambios] = useState({});
  const [texto, setTexto] = useState('');

  const activos = useMemo(
    () =>
      obreros
        .filter((o) => o.activo && buscar(texto, o.nombre, o.rol))
        .sort((a, b) => (b.cuadrilla_id === cuadrillaId) - (a.cuadrilla_id === cuadrillaId) || ordenRol(a.rol) - ordenRol(b.rol) || a.nombre.localeCompare(b.nombre, 'es')),
    [obreros, texto, cuadrillaId]
  );

  if (!c) return <Hoja titulo="Integrantes" />;

  const elegido = (o) => cambios[o.id] ?? o.cuadrilla_id === cuadrillaId;
  const elegidos = obreros.filter((o) => o.activo && elegido(o));
  const movidos = elegidos.filter((o) => o.cuadrilla_id && o.cuadrilla_id !== cuadrillaId).length;

  function guardar() {
    try {
      definirIntegrantes(
        cuadrillaId,
        elegidos.map((o) => o.id)
      );
      avisar(`${c.nombre}: ${elegidos.length} integrante${elegidos.length === 1 ? '' : 's'}`);
      cerrar();
    } catch (e) {
      avisarError(e);
    }
  }

  return (
    <Hoja
      completo
      titulo={`Integrantes de ${c.nombre}`}
      subtitulo={movidos ? `${movidos} vienen de otra cuadrilla` : 'Tocá para sumar o sacar'}
      pie={
        <button type="button" className="btn btn-primario w-full" onClick={guardar}>
          Guardar ({elegidos.length})
        </button>
      }
    >
      <div className="sticky top-0 z-10 -mx-5 flex gap-2 bg-superficie px-5 pb-3">
        <div className="flex-1">
          <Buscador valor={texto} onCambio={setTexto} placeholder="Buscar obrero" />
        </div>
        <button
          type="button"
          aria-label="Obrero nuevo"
          onClick={() => abrir('obreroForm', { cuadrillaId })}
          className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[0.875rem] border border-borde bg-superficie-2"
        >
          <UserPlus size={19} />
        </button>
      </div>
      <ul className="divide-y divide-borde">
        {activos.map((o) => {
          const si = elegido(o);
          const otra = o.cuadrilla_id && o.cuadrilla_id !== cuadrillaId ? cuadrillas.find((x) => x.id === o.cuadrilla_id) : null;
          return (
            <li key={o.id}>
              <button type="button" onClick={() => setCambios((x) => ({ ...x, [o.id]: !si }))} className="flex w-full items-center gap-3 py-2.5 text-left">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 transition-colors ${si ? 'border-ok bg-ok text-white' : 'border-borde'}`}
                >
                  {si && <Check size={16} strokeWidth={3} className="animar-crecer" />}
                </span>
                <Avatar nombre={o.nombre} color={si ? c.color : otra?.color} tam={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{o.nombre}</span>
                  <span className="block truncate text-xs text-tinta-3">
                    {o.rol}
                    {otra && (
                      <span className={si ? 'font-semibold text-deuda' : ''}>
                        {' '}
                        · {si ? 'se mueve desde' : 'está en'} <span style={{ color: colorDe(otra.color) }}>●</span> {otra.nombre}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!activos.length && <p className="py-10 text-center text-tinta-3">No hay obreros con ese nombre.</p>}
    </Hoja>
  );
}
