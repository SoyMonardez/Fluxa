import React, { useState, useEffect } from 'react';
import api from './api';
import { ChevronLeft, ChevronRight, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AttendanceMatrix({ projectId, trigger }) {
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechas, setFechas] = useState([]);

  useEffect(() => {
    if (projectId) {
      cargarSemana();
    }
  }, [semanaOffset, projectId, trigger]);

  const cargarSemana = async () => {
    setLoading(true);
    // Calcular Lunes a Domingo basado en offset
    const curr = new Date();
    const day = curr.getDay(); // 0 is Sunday
    const diffToMonday = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diffToMonday));
    monday.setDate(monday.getDate() + (semanaOffset * 7));

    const arr = [];
    for(let i=0; i<7; i++){
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      arr.push(d.toISOString().split('T')[0]);
    }
    setFechas(arr);

    try {
      const res = await api.get(`/asistencias/semana?start=${arr[0]}&end=${arr[6]}&proyecto_id=${projectId}`);
      setData(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const getAsistenciaWorker = (worker, fecha) => {
    return worker.asistencias?.find(a => a.fecha.startsWith(fecha)) || { cantidad_jornales: 0, extra_pago: 0 };
  };

  const toggleCelda = async (worker, fecha, currentVal) => {
    let nextVal = 0;
    if (currentVal === 0) nextVal = 1;
    else if (currentVal === 1) nextVal = 2;
    else if (currentVal === 2) nextVal = 0;

    // Actualización local temporal (optimista)
    const oldData = [...data];
    setData(data.map(w => {
      if (w.id === worker.id) {
        let asists = [...w.asistencias];
        let as = asists.find(a => a.fecha.startsWith(fecha));
        if (as) { as.cantidad_jornales = nextVal; } 
        else { asists.push({ fecha, cantidad_jornales: nextVal, extra_pago: 0 }); }
        return { ...w, asistencias: asists };
      }
      return w;
    }));

    try {
      const dbObj = getAsistenciaWorker(worker, fecha);
      await api.post('/asistencias', {
        trabajador_id: worker.id,
        fecha: fecha,
        cantidad_jornales: nextVal,
        extra_pago: Number(dbObj.extra_pago)
      });
    } catch (e) {
      setData(oldData); // rollback
      toast.error('Error guardando ciclo');
    }
  };

  const setExtra = async (worker, fecha, extraValue) => {
    const val = Number(extraValue);
    const dbObj = getAsistenciaWorker(worker, fecha);

    // optimista
    setData(data.map(w => {
      if (w.id === worker.id) {
        let asists = [...w.asistencias];
        let as = asists.find(a => a.fecha.startsWith(fecha));
        if (as) { as.extra_pago = val; } 
        else { asists.push({ fecha, cantidad_jornales: 0, extra_pago: val }); }
        return { ...w, asistencias: asists };
      }
      return w;
    }));

    try {
      await api.post('/asistencias', {
        trabajador_id: worker.id,
        fecha: fecha,
        cantidad_jornales: Number(dbObj.cantidad_jornales),
        extra_pago: val
      });
    } catch (e) {
      cargarSemana(); // rollback
      toast.error('Error guardando dinero');
    }
  };

  const getColor = (val) => {
    if (val === 1) return 'bg-[#238636] text-white border-[#2ea043]'; // Verde Github
    if (val === 2) return 'bg-[#1f6feb] text-white border-[#388bfd]'; // Azul Blue
    return 'bg-[#da3633] text-white border-[#f85149]'; // Rojo
  };

  const getDayName = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric' }).format(d);
  };

  return (
    <div className="p-4 bg-[#0d1117] min-h-screen text-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold font-mono">Control de Obra</h2>
        <div className="flex gap-2">
          <button onClick={() => setSemanaOffset(o => o - 1)} className="p-2 border border-blue-500/30 rounded bg-blue-900/20 text-blue-400 hover:bg-blue-500/20"><ChevronLeft size={20}/></button>
          <button onClick={() => setSemanaOffset(0)} className="px-4 py-2 text-sm border border-[#30363d] rounded font-medium hover:bg-[#161b22]">Semana Actual</button>
          <button onClick={() => setSemanaOffset(o => o + 1)} className="p-2 border border-blue-500/30 rounded bg-blue-900/20 text-blue-400 hover:bg-blue-500/20"><ChevronRight size={20}/></button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#30363d] bg-[#161b22] shadow-2xl">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-[#0d1117] border-b border-[#30363d] text-gray-400">
            <tr>
              <th className="px-4 py-4 w-48 font-mono tracking-wider">Obrero</th>
              {fechas.map(f => (
                <th key={f} className="px-2 py-4 tracking-wider text-center border-l border-[#30363d]">{getDayName(f)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="p-6 text-center text-gray-500 animate-pulse">Cargando datos...</td></tr> : 
             data.map((w) => (
              <tr key={w.id} className="border-b border-[#30363d] hover:bg-[#1c2128]">
                <td className="px-4 py-4 font-medium max-w-[150px] truncate" title={w.nombre}>
                  <div className="uppercase tracking-wider">{w.nombre}</div>
                  <div className="text-xs text-gray-500 mt-1">${w.pago_jornal_base}/j</div>
                </td>
                {fechas.map(f => {
                  const att = getAsistenciaWorker(w, f);
                  return (
                    <td key={f} className="px-2 py-3 border-l border-[#30363d] text-center min-w-[90px]">
                      <div className="flex flex-col gap-2 items-center">
                        <button 
                          onClick={() => toggleCelda(w, f, Number(att.cantidad_jornales))}
                          className={`w-14 h-10 flex items-center justify-center rounded font-bold text-lg border transition-all shadow-inner focus:outline-none focus:ring-2 focus:ring-white/20 select-none ${getColor(Number(att.cantidad_jornales))}`}
                        >
                          {Number(att.cantidad_jornales) === 0 ? 'A' : att.cantidad_jornales}
                        </button>
                        <div className="relative group">
                          <span className="absolute left-1 top-1 text-gray-500/50"><DollarSign size={12}/></span>
                          <input 
                            type="number" 
                            className="bg-[#0d1117] border border-[#30363d] rounded text-xs w-16 px-1 pl-4 py-1 text-center focus:border-green-500/50 focus:bg-[#161b22] text-gray-400 placeholder:text-gray-700 transition"
                            placeholder="Extra"
                            defaultValue={Number(att.extra_pago) || ''}
                            onBlur={(e) => {
                              if (e.target.value !== String(att.extra_pago)) {
                                setExtra(w, f, e.target.value || 0);
                              }
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
