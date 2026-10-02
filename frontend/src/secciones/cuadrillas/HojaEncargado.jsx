import { KeyRound } from 'lucide-react';
import { guardarCuadrilla } from '../../lib/acciones';
import { avisar, avisarError } from '../../lib/avisos';
import { ordenar } from '../../lib/derivados';
import { cerrar } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import { vibrar } from '../../lib/vibrar';
import Avatar from '../../ui/Avatar';
import Hoja from '../../ui/Hoja';

export default function HojaEncargado({ cuadrillaId }) {
  const c = useEstado((s) => s.cuadrillas.find((x) => x.id === cuadrillaId));
  const obreros = useEstado((s) => s.obreros);
  if (!c) return <Hoja titulo="Encargado" />;
  const miembros = ordenar(obreros.filter((o) => o.activo && o.cuadrilla_id === c.id));

  async function elegir(o) {
    vibrar(10);
    cerrar();
    try {
      await guardarCuadrilla({ nombre: c.nombre, obra: c.obra, color: c.color, encargado_id: o.id }, c.id);
      avisar(`${o.nombre} es el encargado de ${c.nombre}`);
    } catch (e) {
      avisarError(e);
    }
  }

  return (
    <Hoja titulo="¿Quién es el encargado?" subtitulo={`Responde por las herramientas de ${c.nombre}`}>
      <ul className="space-y-2">
        {miembros.map((o) => {
          const actual = o.id === c.encargado_id;
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => elegir(o)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left ${actual ? 'border-marca bg-marca-suave' : 'border-borde'}`}
              >
                <Avatar nombre={o.nombre} color={c.color} tam={40} encargado={actual} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{o.nombre}</span>
                  <span className="block text-xs text-tinta-3">{o.rol}</span>
                </span>
                {actual && (
                  <span className="chip bg-marca text-white">
                    <KeyRound size={12} /> Actual
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Hoja>
  );
}
