// Alta o edición de una herramienta/máquina. En el alta se puede mandar directo a una cuadrilla.
import { useState } from 'react';
import { Truck, Wrench } from 'lucide-react';
import { guardarHerramienta } from '../../lib/acciones';
import { avisar, avisarError } from '../../lib/avisos';
import { colorDe } from '../../lib/formato';
import { cerrar } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import { Contador, MontoInput, Segmentos } from '../../ui/campos';
import Hoja from '../../ui/Hoja';

export default function HojaHerramientaForm({ herramientaId, cuadrillaId = null }) {
  const existente = useEstado((s) => s.herramientas.find((h) => h.id === herramientaId));
  const cuadrillas = useEstado((s) => s.cuadrillas);
  const [d, setD] = useState(() =>
    existente
      ? { nombre: existente.nombre, tipo: existente.tipo, cantidad: existente.cantidad, valor: existente.valor, nota: existente.nota }
      : { nombre: '', tipo: 'herramienta', cantidad: 1, valor: 0, nota: '' }
  );
  const [destino, setDestino] = useState(cuadrillaId);

  function guardar(e) {
    e?.preventDefault();
    if (!d.nombre.trim()) return;
    try {
      const h = guardarHerramienta(herramientaId ? d : { ...d, cuadrilla_id: destino }, herramientaId);
      const lugar = !herramientaId && destino ? ` y entregada a ${cuadrillas.find((c) => c.id === destino)?.nombre}` : '';
      avisar(herramientaId ? 'Cambios guardados' : `${h.nombre} cargada${lugar}`);
      cerrar();
    } catch (err) {
      avisarError(err);
    }
  }

  return (
    <Hoja
      titulo={herramientaId ? 'Editar herramienta' : 'Nueva herramienta'}
      pie={
        <button type="button" className="btn btn-primario w-full" disabled={!d.nombre.trim()} onClick={guardar}>
          {herramientaId ? 'Guardar cambios' : 'Guardar'}
        </button>
      }
    >
      <form onSubmit={guardar} className="space-y-4">
        <Segmentos
          valor={d.tipo}
          onCambio={(tipo) => setD({ ...d, tipo })}
          opciones={[
            { valor: 'herramienta', texto: 'Herramienta', icono: Wrench },
            { valor: 'maquina', texto: 'Máquina', icono: Truck },
          ]}
        />
        <div>
          <label htmlFor="nombre-herramienta" className="etiqueta">
            Nombre
          </label>
          <input
            id="nombre-herramienta"
            className="campo"
            autoFocus={!herramientaId}
            maxLength={120}
            value={d.nombre}
            onChange={(e) => setD({ ...d, nombre: e.target.value })}
            placeholder={d.tipo === 'maquina' ? 'Ej: Hormigonera 150 L' : 'Ej: Amoladora 9"'}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="etiqueta mb-0">Cantidad total</span>
            <p className="text-xs text-tinta-3">Todas las que tiene la empresa</p>
          </div>
          <Contador valor={d.cantidad} min={herramientaId ? 0 : 1} max={100000} onCambio={(cantidad) => setD({ ...d, cantidad })} />
        </div>
        <div>
          <span className="etiqueta">Valor de cada una (para cobrar si se pierde o rompe)</span>
          <MontoInput valor={d.valor} onCambio={(valor) => setD({ ...d, valor })} tam="chico" />
        </div>
        <div>
          <label htmlFor="nota-herramienta" className="etiqueta">
            Nota (marca, número de serie…)
          </label>
          <input id="nota-herramienta" className="campo" maxLength={255} value={d.nota} onChange={(e) => setD({ ...d, nota: e.target.value })} placeholder="Opcional" />
        </div>
        {!herramientaId && cuadrillas.length > 0 && (
          <div>
            <span className="etiqueta">¿Dónde queda?</span>
            <div className="flex flex-wrap gap-2">
              {[{ id: null, nombre: 'En el pañol', color: null }, ...cuadrillas].map((c) => (
                <button
                  key={c.id ?? 'panol'}
                  type="button"
                  onClick={() => setDestino(c.id)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${destino === c.id ? 'border-tinta bg-superficie-2' : 'border-borde text-tinta-2'}`}
                >
                  {c.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorDe(c.color) }} />}
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Hoja>
  );
}
