// P9: el personal con su jornal, rol y cuadrilla. Tocar → ficha con su cuenta.
import { useMemo, useState } from 'react';
import { Search, UserPlus, Users } from 'lucide-react';
import { buscar, cuentaRapida } from '../../lib/derivados';
import { ordenRol, pesos, pluralRol, ROLES } from '../../lib/formato';
import { abrir } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import Avatar from '../../ui/Avatar';
import { BuscadorPlegable, Segmentos, Vacio } from '../../ui/campos';
import { BotonFlotante, BotonIcono, Contenido, Encabezado } from '../../ui/pagina';
import { useBusqueda } from '../../ui/useBusqueda';

export default function Obreros() {
  const obreros = useEstado((s) => s.obreros);
  const cuadrillas = useEstado((s) => s.cuadrillas);
  const [estado, setEstado] = useState('activos');
  const [rol, setRol] = useState(null);
  const busqueda = useBusqueda();
  const texto = busqueda.texto;

  const activos = useMemo(() => obreros.filter((o) => o.activo), [obreros]);
  const deBaja = obreros.length - activos.length;
  const costoDia = activos.reduce((s, o) => s + o.jornal, 0);
  const cuadrillaDe = useMemo(() => new Map(cuadrillas.map((c) => [c.id, c])), [cuadrillas]);

  const base = useMemo(() => (estado === 'activos' ? activos : obreros.filter((o) => !o.activo)), [estado, activos, obreros]);
  const lista = useMemo(
    () =>
      base
        .filter((o) => (!rol || o.rol === rol) && buscar(texto, o.nombre, o.rol, cuadrillaDe.get(o.cuadrilla_id)?.nombre))
        .sort((a, b) => ordenRol(a.rol) - ordenRol(b.rol) || a.nombre.localeCompare(b.nombre, 'es')),
    [base, rol, texto, cuadrillaDe]
  );
  const porRol = (r) => base.filter((o) => o.rol === r).length;

  return (
    <>
      <Encabezado
        titulo="Obreros"
        subtitulo={`${activos.length} activos · si vienen todos, el día sale ${pesos(costoDia)}`}
        derecha={<BotonIcono icono={Search} etiqueta="Buscar" activo={busqueda.buscando} onClick={busqueda.alternar} />}
      >
        <BuscadorPlegable busqueda={busqueda} placeholder="Nombre, rol o cuadrilla" />
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
          {[null, ...ROLES].map((r) => {
            const activo = rol === r;
            return (
              <button
                key={r ?? 'todos'}
                type="button"
                onClick={() => setRol(r)}
                className={`chip h-8 shrink-0 border px-3 text-[13px] transition-colors ${activo ? 'border-tinta bg-tinta text-superficie' : 'border-borde bg-superficie text-tinta-2'}`}
              >
                {r ? `${pluralRol(r)[0].toUpperCase()}${pluralRol(r).slice(1)}` : 'Todos'}
                <span className="num opacity-60">{r ? porRol(r) : base.length}</span>
              </button>
            );
          })}
        </div>
      </Encabezado>

      <Contenido conBoton>
        {deBaja > 0 && (
          <Segmentos
            className="mt-3"
            valor={estado}
            onCambio={setEstado}
            opciones={[
              { valor: 'activos', texto: `Activos (${activos.length})` },
              { valor: 'baja', texto: `De baja (${deBaja})` },
            ]}
          />
        )}

        {!obreros.length ? (
          <Vacio icono={Users} titulo="Cargá a tu gente" texto="Nombre, rol y cuánto cobra por día. Después los marcás en Asistencia con un toque.">
            <button type="button" className="btn btn-primario" onClick={() => abrir('obreroForm')}>
              <UserPlus size={18} /> Nuevo obrero
            </button>
          </Vacio>
        ) : (
          <ul className="tarjeta mt-3 divide-y divide-borde overflow-hidden">
            {lista.map((o) => {
              const c = cuadrillaDe.get(o.cuadrilla_id);
              const { deuda } = cuentaRapida(o);
              return (
                <li key={o.id}>
                  <button type="button" onClick={() => abrir('ficha', { obreroId: o.id })} className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-superficie-2">
                    <Avatar nombre={o.nombre} color={c?.color} encargado={c?.encargado_id === o.id} apagado={!o.activo} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{o.nombre}</p>
                      <p className="truncate text-[13px] text-tinta-2">
                        {o.rol} · {c ? c.nombre : 'sin cuadrilla'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="num font-bold">{pesos(o.jornal)}</p>
                      {deuda > 0 ? <p className="num text-[12px] font-semibold text-deuda">debe {pesos(deuda)}</p> : <p className="text-[11px] text-tinta-3">por día</p>}
                    </div>
                  </button>
                </li>
              );
            })}
            {!lista.length && <li className="py-10 text-center text-tinta-3">No hay obreros con ese filtro.</li>}
          </ul>
        )}
      </Contenido>

      <BotonFlotante icono={UserPlus} texto="Nuevo" onClick={() => abrir('obreroForm')} />
    </>
  );
}
