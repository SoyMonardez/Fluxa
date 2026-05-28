import React, { useState, useEffect, useCallback } from 'react';
import { useGlobal } from './GlobalContext';
import { ChevronLeft, ChevronRight, Check, X, Clock, DollarSign, AlertCircle } from 'lucide-react';
import api from './api';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const $ = n => `$${Number(n).toLocaleString('es-AR')}`;

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff + offset * 7);

  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

const ROL_COLORS = {
  'Capataz': 'bg-purple-100 text-purple-700',
  'Medio Oficial': 'bg-blue-100 text-blue-700',
  'Oficial': 'bg-indigo-100 text-indigo-700',
  'Ayudante': 'bg-green-100 text-green-700',
};
const rolColor = rol => {
  if (ROL_COLORS[rol]) return ROL_COLORS[rol];
  if (rol?.startsWith('Mobilidad')) return 'bg-orange-100 text-orange-700';
  return 'bg-slate-100 text-slate-600';
};

function initDay(dates) {
  const today = new Date().toISOString().split('T')[0];
  const idx = dates.indexOf(today);
  return idx >= 0 ? idx : Math.min(4, dates.length - 1);
}

export default function Asistencia() {
  const { activeProjectId, activeProject } = useGlobal();
  const [weekOffset, setWeekOffset] = useState(0);
  const initialDates = getWeekDates(0);
  const [dates, setDates] = useState(initialDates);
  const [selectedDay, setSelectedDay] = useState(() => initDay(initialDates));
  const [matriz, setMatriz] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [extraModal, setExtraModal] = useState(null);
  const [extraVal, setExtraVal] = useState('');
  const isFirstRender = React.useRef(true);

  // Only update dates/selectedDay when weekOffset actually changes (skip initial mount)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const d = getWeekDates(weekOffset);
    setDates(d);
    setSelectedDay(initDay(d));
  }, [weekOffset]);

  const loadMatriz = useCallback(async () => {
    if (!activeProjectId || !dates[0]) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/asistencias/semana?proyecto_id=${activeProjectId}&start=${dates[0]}&end=${dates[5]}`);
      // Ensure numeric types (MySQL can return strings for DECIMAL fields)
      setMatriz(data.map(t => ({
        ...t,
        pago_jornal: Number(t.pago_jornal) || 0,
        asistencias: (t.asistencias || []).map(a => ({
          ...a,
          cantidad_jornales: Number(a.cantidad_jornales),
          extra_pago: Number(a.extra_pago) || 0,
        }))
      })));
    } catch {}
    setLoading(false);
  }, [activeProjectId, dates]);

  useEffect(() => { loadMatriz(); }, [loadMatriz]);

  const getAsistencia = (trabajador, fecha) =>
    trabajador.asistencias?.find(a => a.fecha?.split('T')[0] === fecha) || { cantidad_jornales: 0, extra_pago: 0 };

  const saveAsistencia = async (trabajador, fecha, cantidad_jornales, extra_pago) => {
    const key = `${trabajador.id}-${fecha}`;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await api.post('/asistencias', {
        trabajador_id: trabajador.id,
        proyecto_id: activeProjectId,
        fecha,
        cantidad_jornales,
        extra_pago: Number(extra_pago) || 0
      });
      // Update local state optimistically
      setMatriz(prev => prev.map(t => {
        if (t.id !== trabajador.id) return t;
        const existing = t.asistencias?.filter(a => a.fecha?.split('T')[0] !== fecha) || [];
        return { ...t, asistencias: [...existing, { fecha, cantidad_jornales, extra_pago: Number(extra_pago) || 0 }] };
      }));
    } catch {}
    setSaving(s => ({ ...s, [key]: false }));
  };

  const toggleJornal = (trabajador, fecha) => {
    const current = getAsistencia(trabajador, fecha);
    const next = current.cantidad_jornales === 0 ? 1 : current.cantidad_jornales === 1 ? 2 : 0;
    saveAsistencia(trabajador, fecha, next, current.extra_pago);
  };

  const setExtra = async () => {
    if (!extraModal) return;
    const { trabajadorId, fecha } = extraModal;
    const trabajador = matriz.find(t => t.id === trabajadorId);
    if (!trabajador) return;
    const current = getAsistencia(trabajador, fecha);
    await saveAsistencia(trabajador, fecha, current.cantidad_jornales, extraVal);
    setExtraModal(null);
    setExtraVal('');
  };

  // Payroll calculation
  const totalSemana = matriz.reduce((total, t) => {
    const jornal = t.pago_jornal || 0;
    return total + dates.reduce((s, fecha) => {
      const a = getAsistencia(t, fecha);
      return s + (a.cantidad_jornales * jornal) + Number(a.extra_pago || 0);
    }, 0);
  }, 0);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.getDate() + '/' + (d.getMonth() + 1);
  };

  const isToday = (dateStr) => dateStr === new Date().toISOString().split('T')[0];
  const isPast = (dateStr) => dateStr < new Date().toISOString().split('T')[0];

  if (!activeProjectId) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Asistencia</h1>
            <p className="text-xs text-slate-400 truncate max-w-[200px]">{activeProject?.nombre}</p>
          </div>
          <div className="bg-blue-50 rounded-xl px-3 py-1.5 text-right">
            <p className="text-xs text-blue-500 font-medium">Total semana</p>
            <p className="text-lg font-bold text-blue-700">{$(totalSemana)}</p>
          </div>
        </div>

        {/* Week nav */}
        <div className="flex items-center justify-between">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700">
              {weekOffset === 0 ? 'Semana actual' : weekOffset === -1 ? 'Semana pasada' : `Semana ${weekOffset > 0 ? '+' : ''}${weekOffset}`}
            </p>
            <p className="text-xs text-slate-400">{formatDate(dates[0])} — {formatDate(dates[5])}</p>
          </div>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day selector (mobile) */}
        <div className="flex gap-1 mt-2 md:hidden">
          {dates.map((d, i) => (
            <button
              key={d}
              onClick={() => setSelectedDay(i)}
              className={`flex-1 flex flex-col items-center py-1.5 rounded-xl text-xs font-medium transition-colors ${
                selectedDay === i
                  ? 'bg-blue-600 text-white'
                  : isToday(d)
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <span>{DIAS_SHORT[i]}</span>
              <span className="text-[10px] opacity-70">{formatDate(d)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">Cargando...</div>
      ) : matriz.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
          <AlertCircle size={40} className="mb-3 opacity-30" />
          <p className="font-medium">No hay obreros asignados</p>
          <p className="text-sm mt-1">Andá a "Obreros" para asignar personal a esta obra.</p>
        </div>
      ) : (
        <>
          {/* ── MOBILE VIEW: one day at a time ── */}
          <div className="md:hidden flex-1 overflow-y-auto p-3 space-y-2">
            {selectedDay !== null && (
              <>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
                  {DIAS[selectedDay]} {formatDate(dates[selectedDay])}
                  {isToday(dates[selectedDay]) && <span className="ml-2 bg-blue-600 text-white px-2 py-0.5 rounded-full">Hoy</span>}
                </p>
                {matriz.map(t => {
                  const fecha = dates[selectedDay];
                  const asist = getAsistencia(t, fecha);
                  const key = `${t.id}-${fecha}`;
                  const isSaving = saving[key];
                  const jornal = t.pago_jornal || 0;
                  const pagoDia = (asist.cantidad_jornales * jornal) + Number(asist.extra_pago || 0);
                  const totalObrero = dates.reduce((s, d) => {
                    const a = getAsistencia(t, d);
                    return s + (a.cantidad_jornales * jornal) + Number(a.extra_pago || 0);
                  }, 0);

                  return (
                    <div key={t.id} className={`bg-white rounded-2xl border-2 shadow-sm p-4 flex items-center gap-3 transition-all ${
                      asist.cantidad_jornales === 0 ? 'border-slate-200' : 'border-green-400'
                    }`}>
                      <div className="bg-slate-100 rounded-xl w-12 h-12 flex items-center justify-center text-slate-600 font-bold text-lg shrink-0">
                        {t.nombre?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-base truncate">{t.nombre}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rolColor(t.rol)}`}>{t.rol}</span>
                        {Number(asist.extra_pago) > 0 && (
                          <span className="ml-2 text-xs text-amber-600 font-medium">+${Number(asist.extra_pago).toLocaleString('es-AR')} extra</span>
                        )}
                        {totalObrero > 0 && (
                          <p className="text-xs text-slate-400 mt-0.5">Semana: <span className="font-semibold text-slate-600">{$(totalObrero)}</span></p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {pagoDia > 0 && <p className="text-sm font-bold text-green-700">{$(pagoDia)}</p>}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => { setExtraModal({ trabajadorId: t.id, fecha, nombre: t.nombre }); setExtraVal(String(asist.extra_pago || '')); }}
                            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:border-amber-400 hover:text-amber-500"
                          >
                            <DollarSign size={16} />
                          </button>
                          <button
                            disabled={isSaving}
                            onClick={() => toggleJornal(t, fecha)}
                            className={`min-w-[72px] h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                              asist.cantidad_jornales === 0
                                ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                : asist.cantidad_jornales === 1
                                ? 'bg-green-500 text-white hover:bg-green-600'
                                : 'bg-blue-500 text-white hover:bg-blue-600'
                            }`}
                          >
                            {asist.cantidad_jornales === 0 ? <><X size={15} /> Falta</> :
                             asist.cantidad_jornales === 1 ? <><Check size={15} /> 1 jornal</> :
                             <><Clock size={15} /> 2 jornales</>}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* ── DESKTOP VIEW: full matrix ── */}
          <div className="hidden md:block flex-1 overflow-auto p-4">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-slate-500 font-medium w-48">Obrero</th>
                    {dates.map((d, i) => (
                      <th key={d} className={`px-3 py-3 text-center text-slate-500 font-medium ${isToday(d) ? 'text-blue-600' : ''}`}>
                        <div>{DIAS[i]}</div>
                        <div className="text-xs font-normal">{formatDate(d)}</div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-slate-500 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {matriz.map(t => {
                    const jornal = t.pago_jornal || 0;
                    const totalT = dates.reduce((s, fecha) => {
                      const a = getAsistencia(t, fecha);
                      return s + (a.cantidad_jornales * jornal) + Number(a.extra_pago || 0);
                    }, 0);
                    return (
                      <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{t.nombre}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${rolColor(t.rol)}`}>{t.rol}</span>
                        </td>
                        {dates.map(fecha => {
                          const a = getAsistencia(t, fecha);
                          const key = `${t.id}-${fecha}`;
                          return (
                            <td key={fecha} className="px-2 py-2 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  disabled={saving[key]}
                                  onClick={() => toggleJornal(t, fecha)}
                                  className={`w-12 h-9 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                                    a.cantidad_jornales === 0 ? 'bg-slate-100 text-slate-400 hover:bg-slate-200' :
                                    a.cantidad_jornales === 1 ? 'bg-green-500 text-white' :
                                    'bg-blue-500 text-white'
                                  }`}
                                >
                                  {a.cantidad_jornales === 0 ? '—' : a.cantidad_jornales === 1 ? '✓' : '✓✓'}
                                </button>
                                {Number(a.extra_pago) > 0 && (
                                  <span className="text-[10px] text-amber-600 font-medium">+{$(a.extra_pago)}</span>
                                )}
                                <button
                                  onClick={() => { setExtraModal({ trabajadorId: t.id, fecha, nombre: t.nombre }); setExtraVal(String(a.extra_pago || '')); }}
                                  className="text-[10px] text-slate-300 hover:text-amber-500"
                                >
                                  extra
                                </button>
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right font-bold text-slate-800">{$(totalT)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td className="px-4 py-3 font-semibold text-slate-700">Total</td>
                    {dates.map(fecha => {
                      const tot = matriz.reduce((s, t) => {
                        const a = getAsistencia(t, fecha);
                        return s + (a.cantidad_jornales * (t.pago_jornal || 0)) + Number(a.extra_pago || 0);
                      }, 0);
                      return <td key={fecha} className="px-2 py-3 text-center text-sm font-medium text-slate-700">{tot > 0 ? $(tot) : '—'}</td>;
                    })}
                    <td className="px-4 py-3 text-right font-bold text-blue-700">{$(totalSemana)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Extra pay modal */}
      {extraModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4" onClick={() => setExtraModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 text-lg mb-1">Pago extra</h3>
            <p className="text-slate-400 text-sm mb-4">{extraModal.nombre} — {extraModal.fecha}</p>
            <div className="relative mb-4">
              <DollarSign className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                autoFocus
                type="number"
                min="0"
                className="w-full border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-lg font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="0"
                value={extraVal}
                onChange={e => setExtraVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && setExtra()}
              />
            </div>
            <p className="text-xs text-slate-400 mb-4">Horas extra, bonificaciones, viáticos, etc. Podés poner 0 para limpiar.</p>
            <div className="flex gap-3">
              <button onClick={() => setExtraModal(null)} className="flex-1 py-3 border border-slate-200 rounded-xl font-semibold text-slate-500">Cancelar</button>
              <button onClick={setExtra} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
