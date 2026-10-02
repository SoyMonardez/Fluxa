// F9: alta y edición de obreros. "Guardar y agregar otro" para cargar a todos de una vez.
import { useMemo, useRef, useState } from 'react';
import { m } from 'motion/react';
import { UserMinus, UserRoundCheck } from 'lucide-react';
import { darDeBaja, guardarObrero, reactivar } from '../../lib/acciones';
import { avisar, avisarError } from '../../lib/avisos';
import { colorDe, pesos, pluralRol, ROLES } from '../../lib/formato';
import { abrir, cerrar } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import { MontoInput } from '../../ui/campos';
import Hoja from '../../ui/Hoja';

const vacio = (cuadrillaId = null) => ({ nombre: '', rol: 'Ayudante', jornal: 0, telefono: '', nota: '', cuadrilla_id: cuadrillaId });

/** Jornal más común entre los activos de ese rol (para sugerirlo). */
function jornalSugerido(obreros, rol) {
  const cuenta = new Map();
  for (const o of obreros) if (o.activo && o.rol === rol && o.jornal) cuenta.set(o.jornal, (cuenta.get(o.jornal) || 0) + 1);
  let mejor = null;
  for (const [j, n] of cuenta) if (!mejor || n > mejor[1]) mejor = [j, n];
  return mejor?.[0] ?? null;
}

export default function HojaObreroForm({ obreroId, cuadrillaId = null }) {
  const obreros = useEstado((s) => s.obreros);
  const cuadrillas = useEstado((s) => s.cuadrillas);
  const existente = obreros.find((o) => o.id === obreroId);
  const [d, setD] = useState(() =>
    existente
      ? { nombre: existente.nombre, rol: existente.rol, jornal: existente.jornal, telefono: existente.telefono, nota: existente.nota, cuadrilla_id: existente.cuadrilla_id }
      : vacio(cuadrillaId)
  );
  const [enviando, setEnviando] = useState(false);
  const [cargados, setCargados] = useState(0);
  const nombreRef = useRef(null);

  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v }));
  const sugerido = useMemo(() => jornalSugerido(obreros, d.rol), [obreros, d.rol]);
  const roles = ROLES.includes(d.rol) ? ROLES : [...ROLES, d.rol];
  const valido = d.nombre.trim() && d.jornal > 0;

  async function guardar(otro) {
    if (!valido) return;
    setEnviando(true);
    try {
      const o = await guardarObrero({ ...d, nombre: d.nombre.trim(), telefono: d.telefono.trim(), nota: d.nota.trim() }, obreroId);
      if (otro) {
        setCargados((n) => n + 1);
        avisar(`${o.nombre} cargado`);
        setD((x) => ({ ...vacio(x.cuadrilla_id), rol: x.rol, jornal: x.jornal }));
        setEnviando(false);
        nombreRef.current?.focus();
      } else {
        avisar(obreroId ? 'Cambios guardados' : `${o.nombre} cargado`);
        cerrar();
      }
    } catch (e) {
      avisarError(e);
      setEnviando(false);
    }
  }

  function baja() {
    abrir('confirmar', {
      titulo: `Dar de baja a ${existente.nombre}`,
      texto: 'Deja de aparecer en la asistencia y sale de su cuadrilla. Su historia (días, adelantos y pagos) se conserva y lo podés reactivar cuando quieras.',
      confirmar: 'Dar de baja',
      peligro: true,
      onConfirmar: async () => {
        await darDeBaja(existente.id);
        avisar(`${existente.nombre} dado de baja`);
        return 2;
      },
    });
  }

  return (
    <Hoja
      titulo={obreroId ? 'Editar obrero' : 'Nuevo obrero'}
      subtitulo={cargados ? `${cargados} cargado${cargados > 1 ? 's' : ''} en esta tanda` : undefined}
      pie={
        <div className="flex gap-2">
          {!obreroId && (
            <button type="button" className="btn btn-suave flex-1 px-2 text-sm" disabled={!valido || enviando} onClick={() => guardar(true)}>
              Guardar y otro
            </button>
          )}
          <button type="button" className="btn btn-primario flex-1" disabled={!valido || enviando} onClick={() => guardar(false)}>
            {obreroId ? 'Guardar cambios' : 'Guardar'}
          </button>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          guardar(false);
        }}
      >
        <div>
          <label htmlFor="nombre-obrero" className="etiqueta">
            Nombre y apellido
          </label>
          <input
            id="nombre-obrero"
            ref={nombreRef}
            className="campo"
            autoFocus={!obreroId}
            autoCapitalize="words"
            maxLength={100}
            value={d.nombre}
            onChange={(e) => set('nombre')(e.target.value)}
            placeholder="Ej: Juan Pérez"
          />
        </div>

        <div>
          <span className="etiqueta">Rol</span>
          <div className="grid grid-cols-2 gap-2">
            {roles.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => set('rol')(r)}
                className={`relative rounded-xl border px-3 py-2.5 text-sm font-semibold ${d.rol === r ? 'border-tinta' : 'border-borde text-tinta-2'}`}
              >
                {d.rol === r && <m.span layoutId="rol-elegido" className="absolute inset-0 rounded-[0.7rem] bg-superficie-2" />}
                <span className="relative">{r}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="etiqueta">Jornal (lo que cobra por día)</span>
          <MontoInput valor={d.jornal} onCambio={set('jornal')} tam="chico" />
          {sugerido && sugerido !== d.jornal && (
            <button type="button" onClick={() => set('jornal')(sugerido)} className="mt-2 text-sm font-semibold text-marca">
              Usar {pesos(sugerido)} (lo que cobra la mayoría de los {pluralRol(d.rol)})
            </button>
          )}
        </div>

        <div>
          <span className="etiqueta">Cuadrilla</span>
          <div className="flex flex-wrap gap-2">
            {[{ id: null, nombre: 'Ninguna', color: null }, ...cuadrillas].map((c) => {
              const activa = d.cuadrilla_id === c.id;
              return (
                <button
                  key={c.id ?? 'ninguna'}
                  type="button"
                  onClick={() => set('cuadrilla_id')(c.id)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${activa ? 'border-tinta bg-superficie-2' : 'border-borde text-tinta-2'}`}
                >
                  {c.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorDe(c.color) }} />}
                  {c.nombre}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="tel-obrero" className="etiqueta">
              Teléfono
            </label>
            <input
              id="tel-obrero"
              className="campo"
              type="tel"
              inputMode="tel"
              maxLength={40}
              value={d.telefono}
              onChange={(e) => set('telefono')(e.target.value)}
              placeholder="341 555-1234"
            />
          </div>
          <div>
            <label htmlFor="nota-obrero" className="etiqueta">
              Nota
            </label>
            <input id="nota-obrero" className="campo" maxLength={255} value={d.nota} onChange={(e) => set('nota')(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <button type="submit" hidden />
      </form>

      {existente && (
        <div className="mt-6 border-t border-borde pt-4">
          {existente.activo ? (
            <button type="button" className="btn btn-peligro w-full" onClick={baja}>
              <UserMinus size={18} /> Dar de baja
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-suave w-full"
              onClick={() =>
                reactivar(existente.id)
                  .then(() => {
                    avisar(`${existente.nombre} reactivado`);
                    cerrar();
                  })
                  .catch(avisarError)
              }
            >
              <UserRoundCheck size={18} /> Reactivar
            </button>
          )}
        </div>
      )}
    </Hoja>
  );
}
