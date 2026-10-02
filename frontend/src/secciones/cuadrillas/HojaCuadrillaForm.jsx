import { useState } from 'react';
import { Check } from 'lucide-react';
import { guardarCuadrilla } from '../../lib/acciones';
import { avisar, avisarError } from '../../lib/avisos';
import { COLORES } from '../../lib/formato';
import { cerrar, reemplazar } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import Hoja from '../../ui/Hoja';

export default function HojaCuadrillaForm({ cuadrillaId }) {
  const cuadrillas = useEstado((s) => s.cuadrillas);
  const existente = cuadrillas.find((c) => c.id === cuadrillaId);
  const [d, setD] = useState(() =>
    existente
      ? { nombre: existente.nombre, obra: existente.obra, color: existente.color }
      : { nombre: '', obra: '', color: Object.keys(COLORES).find((k) => !cuadrillas.some((c) => c.color === k)) ?? 'naranja' }
  );

  function guardar(e) {
    e?.preventDefault();
    if (!d.nombre.trim()) return;
    try {
      const id = guardarCuadrilla({ nombre: d.nombre, obra: d.obra, color: d.color, encargado_id: existente?.encargado_id ?? null }, cuadrillaId);
      if (cuadrillaId) {
        avisar('Cuadrilla actualizada');
        cerrar();
      } else {
        avisar(`${d.nombre.trim()} creada. Ahora sumá la gente y el encargado.`);
        reemplazar('cuadrilla', { cuadrillaId: id });
      }
    } catch (err) {
      avisarError(err);
    }
  }

  return (
    <Hoja
      titulo={cuadrillaId ? 'Editar cuadrilla' : 'Nueva cuadrilla'}
      pie={
        <button type="button" className="btn btn-primario w-full" disabled={!d.nombre.trim()} onClick={guardar}>
          {cuadrillaId ? 'Guardar cambios' : 'Crear cuadrilla'}
        </button>
      }
    >
      <form onSubmit={guardar} className="space-y-4">
        <div>
          <label htmlFor="nombre-cuadrilla" className="etiqueta">
            Nombre (la obra o el lugar)
          </label>
          <input
            id="nombre-cuadrilla"
            className="campo"
            autoFocus={!cuadrillaId}
            maxLength={80}
            value={d.nombre}
            onChange={(e) => setD({ ...d, nombre: e.target.value })}
            placeholder="Ej: Plaza Funes"
          />
        </div>
        <div>
          <label htmlFor="obra-cuadrilla" className="etiqueta">
            Dirección o descripción
          </label>
          <input
            id="obra-cuadrilla"
            className="campo"
            maxLength={160}
            value={d.obra}
            onChange={(e) => setD({ ...d, obra: e.target.value })}
            placeholder="Opcional"
          />
        </div>
        <div>
          <span className="etiqueta">Color (para reconocerla rápido)</span>
          <div className="flex flex-wrap gap-2.5">
            {Object.entries(COLORES).map(([nombre, hex]) => (
              <button
                key={nombre}
                type="button"
                aria-label={nombre}
                aria-pressed={d.color === nombre}
                onClick={() => setD({ ...d, color: nombre })}
                className={`grid h-11 w-11 place-items-center rounded-full ring-tinta ring-offset-2 ring-offset-superficie transition-[box-shadow,scale] active:scale-90 ${
                  d.color === nombre ? 'ring-[3px]' : 'ring-0'
                }`}
                style={{ background: hex }}
              >
                {d.color === nombre && <Check size={20} strokeWidth={3} className="animar-crecer text-white" />}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" hidden />
      </form>
    </Hoja>
  );
}
