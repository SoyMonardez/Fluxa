// Detalle de una cuadrilla: encargado, integrantes, herramientas e historial. Todo desde acá.
import { Construction, KeyRound, Pencil, Plus, TriangleAlert, Truck, UserPlus, Users, Wrench, X } from 'lucide-react';
import { cerrarCuadrilla } from '../../lib/acciones';
import { avisar } from '../../lib/avisos';
import { useMovimientos } from '../../lib/consultas';
import { cuentaRapida, ordenar } from '../../lib/derivados';
import { colorDe, pesos } from '../../lib/formato';
import { abrir, cerrar } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import Avatar from '../../ui/Avatar';
import Hoja from '../../ui/Hoja';
import ListaMovimientos from '../../ui/ListaMovimientos';

export default function HojaCuadrilla({ cuadrillaId }) {
  const c = useEstado((s) => s.cuadrillas.find((x) => x.id === cuadrillaId));
  const obreros = useEstado((s) => s.obreros);
  const herramientas = useEstado((s) => s.herramientas);
  const stock = useEstado((s) => s.stock);
  const movs = useMovimientos({ cuadrillaId, limite: 12 });

  if (!c) return <Hoja titulo="Cuadrilla cerrada" />;

  const color = colorDe(c.color);
  const miembros = ordenar(
    obreros.filter((o) => o.activo && o.cuadrilla_id === c.id),
    c.encargado_id
  );
  const encargado = miembros.find((o) => o.id === c.encargado_id);
  const suyas = stock
    .filter((s) => s.cuadrilla_id === c.id)
    .map((s) => ({ ...s, h: herramientas.find((h) => h.id === s.herramienta_id) }))
    .filter((x) => x.h)
    .sort((a, b) => a.h.nombre.localeCompare(b.h.nombre, 'es'));
  const unidades = suyas.reduce((s, x) => s + x.cantidad, 0);

  function cerrarla() {
    abrir('confirmar', {
      titulo: `Cerrar ${c.nombre}`,
      texto: (
        <>
          {unidades > 0 && (
            <>
              Las <b>{unidades} herramientas</b> vuelven al pañol.{' '}
            </>
          )}
          {miembros.length > 0 && (
            <>
              Los <b>{miembros.length} obreros</b> quedan sin cuadrilla (siguen activos).{' '}
            </>
          )}
          El historial se conserva.
        </>
      ),
      confirmar: 'Cerrar cuadrilla',
      peligro: true,
      onConfirmar: () => {
        cerrarCuadrilla(c.id);
        avisar(`${c.nombre} cerrada`);
        return 2;
      },
    });
  }

  const cabecera = (
    <div className="relative px-5 pt-3 pb-4">
      <div className="absolute inset-x-0 top-0 h-full opacity-15" style={{ background: `linear-gradient(180deg, ${color}, transparent)` }} />
      <div className="relative flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-bold tracking-wide uppercase" style={{ color }}>
            <Construction size={14} /> Cuadrilla
          </p>
          <h2 className="truncate text-2xl leading-tight font-extrabold">{c.nombre}</h2>
          {c.obra && <p className="truncate text-sm text-tinta-2">{c.obra}</p>}
        </div>
        <button
          type="button"
          aria-label="Editar cuadrilla"
          onClick={() => abrir('cuadrillaForm', { cuadrillaId: c.id })}
          className="grid h-9 w-9 place-items-center rounded-full bg-superficie-2 text-tinta-2"
        >
          <Pencil size={16} />
        </button>
        <button type="button" aria-label="Cerrar" onClick={() => cerrar()} className="grid h-9 w-9 place-items-center rounded-full bg-superficie-2 text-tinta-2">
          <X size={18} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );

  return (
    <Hoja completo titulo={c.nombre} cabecera={cabecera}>
      {/* Encargado */}
      <div className={`rounded-3xl p-4 ${encargado ? 'bg-marca-suave' : 'bg-mal-suave'}`}>
        {encargado ? (
          <div className="flex items-center gap-3">
            <Avatar nombre={encargado.nombre} color={c.color} tam={46} encargado />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-xs font-bold tracking-wide text-marca uppercase">
                <KeyRound size={13} /> Encargado
              </p>
              <p className="truncate text-lg font-bold">{encargado.nombre}</p>
            </div>
            <button type="button" onClick={() => abrir('encargado', { cuadrillaId: c.id })} className="btn btn-suave h-9 min-h-0 bg-superficie px-3 text-sm">
              Cambiar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-mal">
            <TriangleAlert size={22} className="shrink-0" />
            <p className="flex-1 text-sm font-semibold">Falta un encargado que responda por las herramientas.</p>
            {miembros.length > 0 && (
              <button type="button" onClick={() => abrir('encargado', { cuadrillaId: c.id })} className="btn btn-suave h-9 min-h-0 bg-superficie px-3 text-sm text-tinta">
                Elegir
              </button>
            )}
          </div>
        )}
        <p className={`mt-2 text-[13px] ${encargado ? 'text-tinta-2' : 'text-mal'}`}>Da la cara si se roban, falta o se rompe algo por mal uso.</p>
      </div>

      {/* Integrantes */}
      <Seccion
        icono={Users}
        titulo={`Integrantes (${miembros.length})`}
        accion={
          <button type="button" onClick={() => abrir('integrantes', { cuadrillaId: c.id })} className="text-sm font-bold text-marca">
            {miembros.length ? 'Editar' : 'Agregar'}
          </button>
        }
      >
        {miembros.length ? (
          <ul className="divide-y divide-borde rounded-2xl border border-borde">
            {miembros.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => abrir('ficha', { obreroId: o.id })} className="flex w-full items-center gap-3 px-3 py-2 text-left">
                  <Avatar nombre={o.nombre} color={c.color} tam={34} encargado={o.id === c.encargado_id} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{o.nombre}</span>
                    <span className="block text-xs text-tinta-3">
                      {o.rol} · {pesos(o.jornal)}/día
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="num block text-sm font-semibold text-tinta-2">{pesos(cuentaRapida(o).queda)}</span>
                    <span className="block text-[10px] text-tinta-3">le queda</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <button type="button" onClick={() => abrir('integrantes', { cuadrillaId: c.id })} className="btn btn-suave w-full">
            <UserPlus size={18} /> Sumar obreros
          </button>
        )}
      </Seccion>

      {/* Herramientas */}
      <Seccion
        icono={Wrench}
        titulo={`Herramientas (${unidades})`}
        accion={
          <button type="button" onClick={() => abrir('entregar', { cuadrillaId: c.id })} className="flex items-center gap-1 text-sm font-bold text-marca">
            <Plus size={16} /> Entregar
          </button>
        }
      >
        {suyas.length ? (
          <ul className="divide-y divide-borde rounded-2xl border border-borde">
            {suyas.map(({ h, cantidad }) => (
              <li key={h.id}>
                <button type="button" onClick={() => abrir('mover', { herramientaId: h.id, desde: c.id })} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-superficie-2 text-tinta-2">
                    {h.tipo === 'maquina' ? <Truck size={18} /> : <Wrench size={18} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{h.nombre}</span>
                  <span className="num chip bg-superficie-2 text-sm text-tinta">× {cantidad}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <button type="button" onClick={() => abrir('entregar', { cuadrillaId: c.id })} className="btn btn-suave w-full">
            <Plus size={18} /> Entregar herramientas del pañol
          </button>
        )}
        {suyas.length > 0 && <p className="mt-2 text-xs text-tinta-3">Tocá una herramienta para devolverla, mandarla a otra obra o hacer un reclamo.</p>}
      </Seccion>

      <Seccion titulo="Últimos movimientos">
        <ListaMovimientos movimientos={movs} cuadrillaId={c.id} />
      </Seccion>

      <button type="button" onClick={cerrarla} className="btn btn-peligro mt-6 w-full">
        Cerrar cuadrilla (terminó la obra)
      </button>
    </Hoja>
  );
}

function Seccion({ icono: Icono, titulo, accion, children }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center gap-2">
        {Icono && <Icono size={17} className="text-tinta-3" />}
        <h3 className="font-bold">{titulo}</h3>
        <div className="ml-auto">{accion}</div>
      </div>
      {children}
    </section>
  );
}
