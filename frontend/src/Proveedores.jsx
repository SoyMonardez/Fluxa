import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import api from './api';

const CATEGORIAS = ['Ferretería', 'Áridos', 'Hormigón', 'Electricidad', 'Plomería', 'Transporte', 'Herramientas', 'Otro'];
const today = () => new Date().toISOString().split('T')[0];
const $ = n => `$${Number(n).toLocaleString('es-AR')}`;

const emptyForm = () => ({ categoria: 'Ferretería', proveedor: '', descripcion: '', monto: '', fecha: today() });

export default function Proveedores() {
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filtroMes, setFiltroMes] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = filtroMes ? `?mes=${filtroMes}` : '';
      const { data } = await api.get(`/proveedores${params}`);
      setGastos(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [filtroMes]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.monto || Number(form.monto) <= 0) return;
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/proveedores/${editId}`, { ...form, monto: Number(form.monto) });
      } else {
        await api.post('/proveedores', { ...form, monto: Number(form.monto) });
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm());
      await load();
      toast.success(editId ? 'Gasto actualizado' : 'Gasto agregado');
    } catch { toast.error('Error al guardar.'); }
    setSaving(false);
  };

  const handleEdit = (g) => {
    setForm({ categoria: g.categoria, proveedor: g.proveedor || '', descripcion: g.descripcion || '', monto: String(g.monto), fecha: g.fecha?.split('T')[0] || today() });
    setEditId(g.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    try { await api.delete(`/proveedores/${id}`); await load(); } catch {}
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const total = gastos.reduce((s, g) => s + Number(g.monto), 0);

  const porCategoria = CATEGORIAS.reduce((acc, cat) => {
    const sum = gastos.filter(g => g.categoria === cat).reduce((s, g) => s + Number(g.monto), 0);
    if (sum > 0) acc.push({ cat, sum });
    return acc;
  }, []).sort((a, b) => b.sum - a.sum);

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Proveedores</h1>
          <p className="text-slate-400 text-sm">Gastos generales de materiales y servicios</p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setEditId(null); setForm(emptyForm()); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm"
        >
          <Plus size={18} /> Nuevo Gasto
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 col-span-2 md:col-span-1">
          <p className="text-sm text-slate-500">Total gastos</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{$(total)}</p>
        </div>
        {porCategoria.slice(0, 3).map(({ cat, sum }) => (
          <div key={cat} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-sm text-slate-500 truncate">{cat}</p>
            <p className="text-lg font-bold text-slate-800 mt-1">{$(sum)}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-slate-800">{editId ? 'Editar gasto' : 'Nuevo gasto'}</h2>
            <button onClick={() => setShowForm(false)}><X size={20} className="text-slate-400" /></button>
          </div>
          <form onSubmit={handleSave} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Categoría *</label>
              <select required className="input" value={form.categoria} onChange={f('categoria')}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Proveedor</label>
              <input className="input" placeholder="Ej: Ferretería Central" value={form.proveedor} onChange={f('proveedor')} />
            </div>
            <div>
              <label className="label">Monto ($) *</label>
              <input required type="number" min="0" className="input" placeholder="0" value={form.monto} onChange={f('monto')} />
            </div>
            <div>
              <label className="label">Fecha *</label>
              <input required type="date" className="input" value={form.fecha} onChange={f('fecha')} />
            </div>
            <div className="col-span-2 md:col-span-2">
              <label className="label">Descripción</label>
              <input className="input" placeholder="Detalle del gasto..." value={form.descripcion} onChange={f('descripcion')} />
            </div>
            <div className="col-span-2 md:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-500 font-medium">Cancelar</button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-semibold text-sm">
                {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Agregar gasto'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500 shrink-0">Filtrar por mes:</span>
        <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-2">
          <select
            className="text-sm text-slate-700 outline-none bg-transparent"
            value={filtroMes ? filtroMes.split('-')[1] : ''}
            onChange={e => {
              const anio = filtroMes ? filtroMes.split('-')[0] : new Date().getFullYear();
              setFiltroMes(e.target.value ? `${anio}-${e.target.value}` : '');
            }}
          >
            <option value="">Todos los meses</option>
            {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) =>
              <option key={m} value={m}>{['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][i]}</option>
            )}
          </select>
          {filtroMes && (
            <select
              className="text-sm text-slate-700 outline-none bg-transparent"
              value={filtroMes.split('-')[0]}
              onChange={e => setFiltroMes(`${e.target.value}-${filtroMes.split('-')[1]}`)}
            >
              {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
            </select>
          )}
        </div>
        {filtroMes && (
          <button onClick={() => setFiltroMes('')} className="text-xs text-blue-600 hover:underline font-medium px-2 py-1.5 bg-blue-50 rounded-lg">
            Ver todos
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-10 text-slate-400">Cargando...</div>
      ) : gastos.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
          <p>Sin gastos registrados</p>
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="md:hidden space-y-2">
            {gastos.map(g => (
              <div key={g.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">{g.categoria}</span>
                      <span className="text-xs text-slate-400">{g.fecha?.split('T')[0]}</span>
                    </div>
                    {g.proveedor && <p className="font-semibold text-slate-800 text-sm truncate">{g.proveedor}</p>}
                    {g.descripcion && <p className="text-slate-400 text-sm truncate">{g.descripcion}</p>}
                    {!g.proveedor && !g.descripcion && <p className="text-slate-400 text-sm italic">Sin detalle</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="font-bold text-red-600 text-base">{$(g.monto)}</span>
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(g)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={15} /></button>
                      <button onClick={() => handleDelete(g.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-red-50 rounded-2xl border border-red-100 px-4 py-3 flex justify-between items-center">
              <span className="font-semibold text-slate-700">Total</span>
              <span className="font-bold text-red-700 text-lg">{$(total)}</span>
            </div>
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-slate-500 font-medium">Fecha</th>
                  <th className="text-left px-5 py-3 text-slate-500 font-medium">Categoría</th>
                  <th className="text-left px-5 py-3 text-slate-500 font-medium">Proveedor / Descripción</th>
                  <th className="text-right px-5 py-3 text-slate-500 font-medium">Monto</th>
                  <th className="px-3 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {gastos.map(g => (
                  <tr key={g.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">{g.fecha?.split('T')[0]}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">{g.categoria}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-700 max-w-xs">
                      {g.proveedor && <span className="font-medium">{g.proveedor}</span>}
                      {g.proveedor && g.descripcion && <span className="text-slate-400"> — </span>}
                      {g.descripcion && <span className="text-slate-400">{g.descripcion}</span>}
                      {!g.proveedor && !g.descripcion && <span className="text-slate-400 italic">Sin detalle</span>}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-red-600 whitespace-nowrap">{$(g.monto)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(g)} className="p-1.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={15} /></button>
                        <button onClick={() => handleDelete(g.id)} className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td colSpan={3} className="px-5 py-3 font-semibold text-slate-700">Total</td>
                  <td className="px-5 py-3 text-right font-bold text-red-700 text-base whitespace-nowrap">{$(total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
