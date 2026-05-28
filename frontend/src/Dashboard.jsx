import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, HardHat, Users, Building2 } from 'lucide-react';
import api from './api';
import { useGlobal } from './GlobalContext';

const $ = n => `$${Number(n).toLocaleString('es-AR')}`;

const KpiCard = ({ label, value, icon: Icon, color }) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
    <div className={`inline-flex p-2 rounded-xl mb-3 ${color}`}>
      <Icon size={20} className="text-white" />
    </div>
    <p className="text-sm text-slate-500 font-medium">{label}</p>
    <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
  </div>
);

export default function Dashboard() {
  const { activeProjectId, activeProject } = useGlobal();
  const [resumen, setResumen] = useState(null);
  const [grafico, setGrafico] = useState([]);
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const qs = activeProjectId ? `?proyecto_id=${activeProjectId}` : '';
        const [r, g, o] = await Promise.all([
          api.get(`/dashboard/resumen${qs}`),
          api.get(`/dashboard/grafico${qs}`),
          api.get('/dashboard/obras')
        ]);
        setResumen(r.data);
        setGrafico(g.data.map(d => ({
          ...d,
          mes: d.mes.slice(5) + '/' + d.mes.slice(0, 4)
        })));
        setObras(o.data);
      } catch {}
      setLoading(false);
    };
    load();
  }, [activeProjectId]);

  if (loading) return <div className="p-8 text-slate-400 text-center">Cargando...</div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
          {activeProject ? activeProject.nombre : 'Resumen General'}
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {activeProject ? 'Vista financiera de esta obra' : 'Vista financiera de toda la empresa'}
        </p>
      </div>

      {/* KPIs */}
      <div className={`grid gap-3 md:gap-4 ${activeProject ? 'grid-cols-2 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
        <KpiCard label="Total Ingresos" value={$(resumen?.total_ingresos)} icon={TrendingUp} color="bg-green-500" />
        <KpiCard label="Nómina Obreros" value={$(resumen?.total_nomina)} icon={Users} color="bg-orange-500" />
        {!activeProject && (
          <KpiCard label="Proveedores" value={$(resumen?.total_proveedores)} icon={Wallet} color="bg-red-500" />
        )}
        <KpiCard
          label={activeProject ? 'Margen' : 'Liquidez Total'}
          value={$(resumen?.liquidez)}
          icon={resumen?.liquidez >= 0 ? TrendingUp : TrendingDown}
          color={resumen?.liquidez >= 0 ? 'bg-blue-600' : 'bg-red-600'}
        />
      </div>

      {/* Chart */}
      {grafico.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Movimientos por mes</h2>
          <div className="h-64 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafico} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                  formatter={v => `$${Number(v).toLocaleString('es-AR')}`}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[4,4,0,0]} />
                <Bar dataKey="nomina" name="Nómina" fill="#f97316" radius={[4,4,0,0]} />
                <Bar dataKey="proveedores" name="Proveedores" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Per-obra: cards on mobile, table on desktop */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Building2 size={18} className="text-blue-600" />
          <h2 className="font-semibold text-slate-700">Margen por obra</h2>
        </div>

        {obras.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">Sin obras registradas</p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-50">
              {obras.map(o => (
                <div key={o.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-slate-800 text-sm">{o.nombre}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      o.estado === 'Activo' ? 'bg-green-100 text-green-700' :
                      o.estado === 'Pausado' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>{o.estado}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div>
                      <p className="text-slate-400">Ingresos</p>
                      <p className="font-bold text-green-700">{$(o.ingresos)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Nómina</p>
                      <p className="font-bold text-orange-600">{$(o.nomina)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Margen</p>
                      <p className={`font-bold ${o.margen >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{$(o.margen)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-slate-500 font-medium">Obra</th>
                    <th className="text-left px-5 py-3 text-slate-500 font-medium">Estado</th>
                    <th className="text-right px-5 py-3 text-slate-500 font-medium">Ingresos</th>
                    <th className="text-right px-5 py-3 text-slate-500 font-medium">Nómina</th>
                    <th className="text-right px-5 py-3 text-slate-500 font-medium">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {obras.map(o => (
                    <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">{o.nombre}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          o.estado === 'Activo' ? 'bg-green-100 text-green-700' :
                          o.estado === 'Pausado' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>{o.estado}</span>
                      </td>
                      <td className="px-5 py-3 text-right text-green-700 font-medium whitespace-nowrap">{$(o.ingresos)}</td>
                      <td className="px-5 py-3 text-right text-orange-600 font-medium whitespace-nowrap">{$(o.nomina)}</td>
                      <td className={`px-5 py-3 text-right font-bold whitespace-nowrap ${o.margen >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                        {$(o.margen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
