// F7: robo, faltante o rotura por mal uso. Queda a nombre del encargado y,
// si se decide, se le cobra (cargo que se descuenta como un adelanto).
import { useState } from 'react';
import { KeyRound, ShieldAlert, Warehouse } from 'lucide-react';
import { registrarReclamo } from '../../lib/acciones';
import { avisar, avisarError } from '../../lib/avisos';
import { enObras, ordenar } from '../../lib/derivados';
import { hoy } from '../../lib/fechas';
import { colorDe, pesos, primerNombre } from '../../lib/formato';
import { cerrar } from '../../lib/hojas';
import { useEstado } from '../../lib/store';
import { Contador, Interruptor, MontoInput } from '../../ui/campos';
import Hoja from '../../ui/Hoja';

const TIPOS = [
  { valor: 'robo', texto: 'Robo' },
  { valor: 'faltante', texto: 'Faltante' },
  { valor: 'rotura', texto: 'Rotura por mal uso' },
];

export default function HojaReclamo({ herramientaId, cuadrillaId = null, elegirLugar = false }) {
  const h = useEstado((s) => s.herramientas.find((x) => x.id === herramientaId));
  const stock = useEstado((s) => s.stock);
  const cuadrillas = useEstado((s) => s.cuadrillas);
  const obreros = useEstado((s) => s.obreros);

  const lugares = stock.filter((s) => s.herramienta_id === herramientaId && cuadrillas.some((c) => c.id === s.cuadrilla_id));
  const panol = (h?.cantidad ?? 0) - enObras(lugares);
  const opciones = [...lugares.map((l) => ({ id: l.cuadrilla_id, hay: l.cantidad })), ...(panol > 0 ? [{ id: null, hay: panol }] : [])];

  const [lugar, setLugar] = useState(cuadrillaId ?? opciones[0]?.id ?? null);
  const [tipo, setTipo] = useState('rotura');
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState('');
  const [cobrar, setCobrar] = useState(false);
  const [aQuien, setAQuien] = useState(null);
  const [monto, setMonto] = useState(null);
  const [enviando, setEnviando] = useState(false);

  if (!h) return <Hoja titulo="Reclamo" />;

  const c = cuadrillas.find((x) => x.id === lugar) ?? null;
  const hay = opciones.find((o) => o.id === lugar)?.hay ?? 0;
  const n = Math.min(Math.max(1, cantidad), Math.max(1, hay));
  const encargado = obreros.find((o) => o.id === c?.encargado_id);
  const miembros = c ? ordenar(obreros.filter((o) => o.activo && o.cuadrilla_id === c.id), c.encargado_id) : [];
  const cobrado = obreros.find((o) => o.id === (aQuien ?? encargado?.id));
  const montoFinal = monto ?? h.valor * n;

  async function registrar() {
    setEnviando(true);
    try {
      await registrarReclamo({
        herramienta_id: h.id,
        cuadrilla_id: lugar,
        tipo,
        cantidad: n,
        nota: nota.trim(),
        fecha: hoy(),
        cargo: cobrar && cobrado && montoFinal > 0 ? { obrero_id: cobrado.id, monto: montoFinal } : null,
      });
      const texto = TIPOS.find((t) => t.valor === tipo).texto;
      avisar(
        `${texto} registrado: ${n} × ${h.nombre}${encargado ? ` (responde ${primerNombre(encargado.nombre)})` : ''}${
          cobrar && cobrado && montoFinal > 0 ? `. Se le descuentan ${pesos(montoFinal)} a ${primerNombre(cobrado.nombre)}` : ''
        }`,
        { duracion: 5000 }
      );
      cerrar();
    } catch (e) {
      avisarError(e);
      setEnviando(false);
    }
  }

  return (
    <Hoja
      titulo={`Reclamo · ${h.nombre}`}
      subtitulo="Las unidades se dan de baja del inventario"
      pie={
        <button type="button" className="btn w-full bg-mal text-white" disabled={!hay || enviando} onClick={registrar}>
          <ShieldAlert size={19} /> Registrar reclamo
        </button>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        {TIPOS.map((t) => (
          <button
            key={t.valor}
            type="button"
            onClick={() => setTipo(t.valor)}
            className={`rounded-2xl border px-2 py-3 text-sm leading-tight font-bold ${tipo === t.valor ? 'border-mal bg-mal-suave text-mal' : 'border-borde text-tinta-2'}`}
          >
            {t.texto}
          </button>
        ))}
      </div>

      {(elegirLugar || !cuadrillaId) && opciones.length > 1 && (
        <>
          <p className="etiqueta mt-4">¿Dónde pasó?</p>
          <div className="flex flex-wrap gap-2">
            {opciones.map((o) => {
              const cu = cuadrillas.find((x) => x.id === o.id);
              return (
                <button
                  key={o.id ?? 'panol'}
                  type="button"
                  onClick={() => setLugar(o.id)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${lugar === o.id ? 'border-tinta bg-superficie-2' : 'border-borde text-tinta-2'}`}
                >
                  {cu ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorDe(cu.color) }} /> : <Warehouse size={15} />}
                  {cu?.nombre ?? 'Pañol'} <span className="num opacity-60">{o.hay}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-superficie-2 p-3">
        <span>
          <span className="block font-semibold">Cantidad</span>
          <span className="text-xs text-tinta-3">
            Hay {hay} en {c?.nombre ?? 'el pañol'}
          </span>
        </span>
        <Contador valor={n} min={1} max={hay} onCambio={setCantidad} />
      </div>

      <div className={`mt-3 flex items-center gap-3 rounded-2xl p-3 ${c ? (encargado ? 'bg-marca-suave' : 'bg-mal-suave') : 'bg-superficie-2'}`}>
        <KeyRound size={20} className={encargado ? 'text-marca' : 'text-tinta-3'} />
        <p className="text-sm">
          {c ? (
            encargado ? (
              <>
                Responde <b>{encargado.nombre}</b>, encargado de {c.nombre}.
              </>
            ) : (
              <>{c.nombre} no tiene encargado: el reclamo queda sin responsable.</>
            )
          ) : (
            'Estaba en el pañol: no hay encargado de obra.'
          )}
        </p>
      </div>

      <label htmlFor="nota-reclamo" className="etiqueta mt-4">
        ¿Qué pasó?
      </label>
      <input id="nota-reclamo" className="campo" maxLength={255} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: la dejaron afuera de noche" />

      <div className="mt-4 rounded-2xl border border-borde p-3">
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-semibold">Cobrárselo</span>
            <span className="text-xs text-tinta-3">Se descuenta en su próximo pago, como un adelanto</span>
          </span>
          <Interruptor activo={cobrar} onCambio={setCobrar} etiqueta="Cobrárselo" />
        </div>
        {cobrar && (
          <div className="mt-3 space-y-3">
            {miembros.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {miembros.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setAQuien(o.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${cobrado?.id === o.id ? 'border-tinta bg-superficie-2' : 'border-borde text-tinta-2'}`}
                  >
                    {o.nombre}
                    {o.id === c?.encargado_id && ' 🔑'}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-tinta-3">No hay integrantes a quién cobrarle.</p>
            )}
            <MontoInput valor={montoFinal} onCambio={setMonto} tam="chico" />
            {h.valor > 0 && monto == null && <p className="text-xs text-tinta-3">Sugerido: valor de la herramienta × {n}.</p>}
          </div>
        )}
      </div>
    </Hoja>
  );
}
