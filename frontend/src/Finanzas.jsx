import React, { useState, useEffect, useContext } from 'react';
import { GlobalContext } from './GlobalContext';
import { ArrowDownRight, ArrowUpRight, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from './api';

export default function Finanzas() {
  const { activeProjectId } = useContext(GlobalContext);
  const [historial, setHistorial] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState('Egreso');
  const [categoria, setCategoria] = useState('');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const cargarHistorial = async () => {
    try {
      const res = await api.get(`/finanzas/historial?proyecto_id=${activeProjectId}`);
      setHistorial(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeProjectId) cargarHistorial();
  }, [activeProjectId]);

  const handleCrear = async (e) => {
    e.preventDefault();
    try {
      await api.post('/finanzas', {
        proyecto_id: activeProjectId,
        tipo,
        monto: Number(monto),
        categoria,
        descripcion,
        fecha: new Date().toISOString().split('T')[0]
      });
      setShowForm(false);
      setMonto('');
      setCategoria('');
      setDescripcion('');
      cargarHistorial();
      toast.success('Movimiento registrado');
    } catch(e) {
      toast.error("Error al guardar finanza");
    }
  };

  if (!activeProjectId) return null;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Proveedores y Caja</h1>
          <p className="text-gray-400">Control de gastos e ingresos de la obra activa.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-medium transition flex items-center gap-2"
        >
          <Plus size={18} /> Registrar Movimiento
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCrear} className="bg-[#161b22] border border-[#30363d] p-6 rounded-lg mb-8 max-w-3xl">
          <div className="flex space-x-4 mb-6">
            <button type="button" onClick={() => setTipo('Egreso')} className={`flex-1 py-2 rounded border font-medium ${tipo === 'Egreso' ? 'bg-red-900/40 border-red-500 text-red-500' : 'border-[#30363d] text-gray-500'}`}>
               Pagar Proveedor / Gasto
            </button>
            <button type="button" onClick={() => setTipo('Ingreso')} className={`flex-1 py-2 rounded border font-medium ${tipo === 'Ingreso' ? 'bg-green-900/40 border-green-500 text-green-500' : 'border-[#30363d] text-gray-500'}`}>
               Ingreso de Dinero
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Concepto / Proveedor</label>
              <input required value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ej: Materiales, Cemento, Ingreso Inicial..."
                className="w-full bg-[#0d1117] border border-[#30363d] px-3 py-2 rounded text-white focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Monto ($)</label>
              <input required type="number" min="1" value={monto} onChange={e => setMonto(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] px-3 py-2 rounded text-white focus:border-blue-500 outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Detalles Extra</label>
              <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Factura Nº, RUT, o Notas..."
                className="w-full bg-[#0d1117] border border-[#30363d] px-3 py-2 rounded text-white focus:border-blue-500 outline-none h-16" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded text-gray-400 hover:text-white">Cancelar</button>
            <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded font-medium">Procesar Movimiento</button>
          </div>
        </form>
      )}

      <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden shadow-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#0d1117] border-b border-[#30363d] text-gray-400 uppercase text-xs">
            <tr>
              <th className="px-6 py-4 font-medium">Fecha</th>
              <th className="px-6 py-4 font-medium">Categoría</th>
              <th className="px-6 py-4 font-medium">Descripción</th>
              <th className="px-6 py-4 font-medium text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#30363d]">
            {historial.map(f => (
              <tr key={f.id} className="hover:bg-[#1c2128]">
                <td className="px-6 py-4 whitespace-nowrap text-gray-300">{f.fecha.split('T')[0]}</td>
                <td className="px-6 py-4 font-medium text-white">
                  <div className="flex items-center gap-2">
                    {f.tipo === 'Ingreso' ? <ArrowUpRight size={16} className="text-green-500" /> : <ArrowDownRight size={16} className="text-red-500" />}
                    {f.categoria}
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-400 max-w-xs truncate">{f.descripcion}</td>
                <td className={`px-6 py-4 text-right font-mono font-medium ${f.tipo === 'Ingreso' ? 'text-green-500' : 'text-red-500'}`}>
                  {f.tipo === 'Ingreso' ? '+' : '-'}${Number(f.monto).toLocaleString()}
                </td>
              </tr>
            ))}
            {historial.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No hay movimientos registrados para esta obra.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
