import React, { useState, useEffect } from 'react';
import { useGlobal } from './GlobalContext';
import { Building2, Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import api from './api';

const today = () => new Date().toISOString().split('T')[0];
const $ = n => `$${Number(n).toLocaleString('es-AR')}`;

const ESTADOS = ['Activo', 'Pausado', 'Terminado'];
const TIPOS_INGRESO = ['Adelanto', 'Pago Parcial', 'Pago Final', 'Otro'];

const emptyForm = () => ({ nombre: '', cliente: '', descripcion: '', fecha_inicio: today(), fecha_fin: '', estado: 'Activo' });

export default function Obras() {
  const { proyectos, fetchProyectos } = useGlobal();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [ingresos, setIngresos] = useState({});
  const [ingresoForm, setIngresoForm] = useState({ tipo: 'Pago Parcial', monto: '', descripcion: '', fecha: today() });
  const [saving, setSaving] = useState(false);

  const loadIngresos = async (id) => {
    try {
      const { data } = await api.get(`/ingresos?proyecto_id=${id}`);
      setIngresos(prev => ({ ...prev, [id]: data }));
    } catch {}
  };

  const toggleExpand = (id) => {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (next && !ingresos[next]) loadIngresos(next);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/proyectos/${editId}`, form);
      } else {
        await api.post('/proyectos', form);
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm());
      await fetchProyectos();
      toast.success(editId ? 'Obra actualizada' : 'Obra creada');
    } catch { toast.error('Error al guardar la obra.'); }
    setSaving(false);
  };

  const handleEdit = (p) => {
    setForm({ nombre: p.nombre, cliente: p.cliente || '', descripcion: p.descripcion || '', fecha_inicio: p.fecha_inicio?.split('T')[0] || today(), fecha_fin: p.fecha_fin?.split('T')[0] || '', estado: p.estado });
    setEditId(p.id);
    setShowForm(true);
    setExpanded(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta obra? Se perderán todos sus datos.')) return;
    try { await api.delete(`/proyectos/${id}`); await fetchProyectos(); toast.success('Obra eliminada'); } catch { toast.error('Error al eliminar.'); }
  };

  const handleAddIngreso = async (proyId) => {
    if (!ingresoForm.monto || Number(ingresoForm.monto) <= 0) return;
    try {
      await api.post('/ingresos', { ...ingresoForm, monto: Number(ingresoForm.monto), proyecto_id: proyId });
      setIngresoForm({ tipo: 'Pago Parcial', monto: '', descripcion: '', fecha: today() });
      await loadIngresos(proyId);
      toast.success('Ingreso agregado');
    } catch { toast.error('Error al guardar ingreso.'); }
  };

  const handleDeleteIngreso = async (ingresoId, proyId) => {
    if (!confirm('¿Eliminar este ingreso?')) return;
    try { await api.delete(`/ingresos/${ingresoId}`); await loadIngresos(proyId); } catch {}
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));
  const fi = (k) => (e) => setIngresoForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Obras</h1>
          <p className="text-slate-400 text-sm">{proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''} registrado{proyectos.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm()); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
        >
          <Plus size={18} /> Nueva Obra
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">{editId ? 'Editar Obra' : 'Nueva Obra'}</h2>
            <button onClick={() => setShowForm(false)}><X size={20} className="text-slate-400" /></button>
          </div>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Nombre de la obra *</label>
              <input required className="input" placeholder="Ej: Vivienda Los Pinos" value={form.nombre} onChange={f('nombre')} />
            </div>
            <div>
              <label className="label">Cliente</label>
              <input className="input" placeholder="Nombre del cliente" value={form.cliente} onChange={f('cliente')} />
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" value={form.estado} onChange={f('estado')}>
                {ESTADOS.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fecha de inicio *</label>
              <input required type="date" className="input" value={form.fecha_inicio} onChange={f('fecha_inicio')} />
            </div>
            <div>
              <label className="label">Fecha de fin (opcional)</label>
              <input type="date" className="input" value={form.fecha_fin} onChange={f('fecha_fin')} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Descripción / Dirección</label>
              <textarea className="input" rows={2} placeholder="Ubicación, notas..." value={form.descripcion} onChange={f('descripcion')} />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium">Cancelar</button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm">
                {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear obra'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {proyectos.length === 0 && !showForm && (
        <div className="text-center py-16 text-slate-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>Todavía no hay obras. Creá la primera.</p>
        </div>
      )}

      <div className="space-y-3">
        {proyectos.map(p => {
          const ing = ingresos[p.id] || [];
          const totalIng = ing.reduce((s, i) => s + Number(i.monto), 0);
          const isOpen = expanded === p.id;

          return (
            <div key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 p-4">
                <div className="bg-blue-100 rounded-xl p-2.5">
                  <Building2 size={20} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{p.nombre}</p>
                  <p className="text-xs text-slate-400">{p.cliente || 'Sin cliente'} · {p.fecha_inicio?.split('T')[0]}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
                  p.estado === 'Activo' ? 'bg-green-100 text-green-700' :
                  p.estado === 'Pausado' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-slate-100 text-slate-500'
                }`}>{p.estado}</span>
                <div className="flex items-center gap-1 ml-1">
                  <button onClick={() => handleEdit(p)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><Pencil size={16} /></button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={16} /></button>
                  <button onClick={() => toggleExpand(p.id)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-50">
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {/* Expanded: Ingresos */}
              {isOpen && (
                <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-1.5"><DollarSign size={15} /> Ingresos de esta obra</h3>
                      <span className="text-sm font-bold text-green-700">${totalIng.toLocaleString('es-AR')}</span>
                    </div>

                    {/* Add ingreso */}
                    <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-2 mb-3">
                      <div className="grid grid-cols-2 gap-2">
                        <select className="input text-sm" value={ingresoForm.tipo} onChange={fi('tipo')}>
                          {TIPOS_INGRESO.map(t => <option key={t}>{t}</option>)}
                        </select>
                        <input type="number" className="input text-sm" placeholder="Monto $" value={ingresoForm.monto} onChange={fi('monto')} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" className="input text-sm" value={ingresoForm.fecha} onChange={fi('fecha')} />
                        <input className="input text-sm" placeholder="Descripción (opcional)" value={ingresoForm.descripcion} onChange={fi('descripcion')} />
                      </div>
                      <button onClick={() => handleAddIngreso(p.id)} className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-semibold">
                        + Agregar ingreso
                      </button>
                    </div>

                    {/* Ingreso list */}
                    {ing.length === 0 ? (
                      <p className="text-slate-400 text-sm text-center py-2">Sin ingresos registrados</p>
                    ) : (
                      <div className="space-y-1.5">
                        {ing.map(i => (
                          <div key={i.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                            <div>
                              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{i.tipo}</span>
                              {i.descripcion && <span className="text-xs text-slate-400 ml-2">{i.descripcion}</span>}
                              <span className="text-xs text-slate-400 ml-2">{i.fecha?.split('T')[0]}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-green-700 text-sm">${Number(i.monto).toLocaleString('es-AR')}</span>
                              <button onClick={() => handleDeleteIngreso(i.id, p.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
