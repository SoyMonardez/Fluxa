// P6/P10: cada cuadrilla (obra) con su gente, su encargado y sus herramientas.
import { useMemo } from 'react';
import { ChevronRight, HardHat, KeyRound, Plus, TriangleAlert, Warehouse, Wrench } from 'lucide-react';
import { enObras, stockPorCuadrilla, stockPorHerramienta } from '../../lib/derivados';
import { colorDe, plural } from '../../lib/formato';
import { abrir } from '../../lib/hojas';
import { ir } from '../../lib/ruta';
import { useEstado } from '../../lib/store';
import Avatar from '../../ui/Avatar';
import { Vacio } from '../../ui/campos';
import { BotonFlotante, Contenido, Encabezado } from '../../ui/pagina';

export default function Cuadrillas() {
  const cuadrillas = useEstado((s) => s.cuadrillas);
  const obreros = useEstado((s) => s.obreros);
  const herramientas = useEstado((s) => s.herramientas);
  const stock = useEstado((s) => s.stock);

  const porCuadrilla = useMemo(() => stockPorCuadrilla(stock), [stock]);
  const activos = obreros.filter((o) => o.activo);
  const sueltos = activos.filter((o) => !cuadrillas.some((c) => c.id === o.cuadrilla_id));
  const unidadesPanol = useMemo(() => {
    const porH = stockPorHerramienta(stock);
    return herramientas.reduce((s, h) => s + h.cantidad - enObras(porH.get(h.id)), 0);
  }, [herramientas, stock]);

  return (
    <>
      <Encabezado titulo="Cuadrillas" subtitulo={`${cuadrillas.length} en obra · cada una con su encargado`} />
      <Contenido conBoton>
        {!cuadrillas.length ? (
          <Vacio icono={HardHat} titulo="Armá tu primera cuadrilla" texto="Por ejemplo “Plaza Funes”: 4 obreros, un encargado que responde por las herramientas, y lo que se llevaron.">
            <button type="button" className="btn btn-primario" onClick={() => abrir('cuadrillaForm')}>
              <Plus size={18} /> Nueva cuadrilla
            </button>
          </Vacio>
        ) : (
          <div className="mt-3 space-y-3">
            {cuadrillas.map((c, i) => {
              const miembros = activos.filter((o) => o.cuadrilla_id === c.id);
              const encargado = miembros.find((o) => o.id === c.encargado_id);
              const unidades = (porCuadrilla.get(c.id) ?? []).reduce((s, x) => s + x.cantidad, 0);
              return (
                <button
                  key={c.id}
                  type="button"
                  style={{ animationDelay: `${i * 0.04}s` }}
                  onClick={() => abrir('cuadrilla', { cuadrillaId: c.id })}
                  className="tarjeta animar-subir relative block w-full overflow-hidden p-4 pl-5 text-left transition-transform active:scale-[0.98]"
                >
                  <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: colorDe(c.color) }} />
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg leading-tight font-bold">{c.nombre}</p>
                      {c.obra && <p className="truncate text-sm text-tinta-3">{c.obra}</p>}
                    </div>
                    <ChevronRight size={20} className="mt-1 shrink-0 text-tinta-3" />
                  </div>
                  <div className="mt-2.5">
                    {encargado ? (
                      <p className="flex items-center gap-1.5 text-sm">
                        <KeyRound size={15} className="text-marca" />
                        <span className="text-tinta-2">Encargado:</span> <b className="truncate">{encargado.nombre}</b>
                      </p>
                    ) : (
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-mal">
                        <TriangleAlert size={15} /> Falta encargado de herramientas
                      </p>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex -space-x-1.5">
                      {miembros.slice(0, 6).map((o) => (
                        <div key={o.id} className="rounded-full ring-2 ring-superficie">
                          <Avatar nombre={o.nombre} color={c.color} tam={30} />
                        </div>
                      ))}
                      {miembros.length > 6 && (
                        <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-superficie-2 text-xs font-bold ring-2 ring-superficie">+{miembros.length - 6}</span>
                      )}
                      {!miembros.length && <span className="text-sm text-tinta-3">Sin integrantes</span>}
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-sm text-tinta-2">
                      <span className="num">
                        <b className="text-tinta">{miembros.length}</b> obreros
                      </span>
                      <span className="num flex items-center gap-1">
                        <Wrench size={14} /> <b className="text-tinta">{unidades}</b>
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => ir('herramientas')} className="tarjeta flex items-center gap-3 p-3.5 text-left">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-superficie-2 text-tinta-2">
              <Warehouse size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm text-tinta-2">En el pañol</span>
              <span className="num block font-bold">{plural(unidadesPanol, 'unidad', 'unidades')}</span>
            </span>
          </button>
          <button type="button" onClick={() => ir('obreros')} className="tarjeta flex items-center gap-3 p-3.5 text-left">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-superficie-2 text-tinta-2">
              <HardHat size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm text-tinta-2">Sin cuadrilla</span>
              <span className="num block font-bold">{plural(sueltos.length, 'obrero', 'obreros')}</span>
            </span>
          </button>
        </div>
      </Contenido>
      {cuadrillas.length > 0 && <BotonFlotante icono={Plus} texto="Cuadrilla" onClick={() => abrir('cuadrillaForm')} />}
    </>
  );
}
