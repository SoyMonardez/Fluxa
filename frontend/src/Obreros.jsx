import React, { useState, useEffect } from 'react';
import { useGlobal } from './GlobalContext';
import { Plus, X, Pencil, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from './api';

const ROLES_BASE = ['Capataz', 'Medio Oficial', 'Oficial', 'Ayudante'];
const ROLES_MOV = ['Mobilidad 1', 'Mobilidad 2', 'Mobilidad 3', 'Mobilidad 4'];
const TODOS_ROLES = [...ROLES_BASE, ...ROLES_MOV, 'Otro'];
const today = () => new Date().toISOString().split('T')[0];

const ROL_COLORS = {
  'Capataz': 'bg-purple-100 text-purple-700',
  'Medio Oficial': 'bg-blue-100 text-blue-700',
  'Oficial': 'bg-indigo-100 text-indigo-700',
  'Ayudante': 'bg-green-100 text-green-700',
};

const rolColor = (rol) => {
  if (ROL_COLORS[rol]) return ROL_COLORS[rol];
  if (rol?.startsWith('Mobilidad')) return 'bg-orange-100 text-orange-700';
  return 'bg-slate-100 text-slate-600';
};

export default function Obreros() {
  const { activeProjectId } = useGlobal();
  const [trabajadores, setTrabajadores] = useState([]);
  const [asignados, setAsignados] = useState([]);
  const [tab, setTab] = useState('asignados'); // 'asignados' | 'todos'
  const [showForm, setShowForm] = useState(false);
  const [showAsignar, setShowAsignar] = useState(false);
  const [form, setForm] = useState({ nombre: '', rol: 'Oficial', rolCustom: '' });
  const [asigForm, setAsigForm] = useState({ trabajador_id: '', pago_jornal: '', fecha_desde: today() });
  const [editAsig, setEditAsig] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    try {
      const [{ data: todos }, { data: asig }] = await Promise.all([
        api.get('/trabajadores'),
        activeProjectId ? api.get(`/asignaciones?proyecto_id=${activeProjectId}`) : { data: [] }
      ]);
      setTrabajadores(todos);
      setAsignados(asig);
    } catch {}
  };

  useEffect(() => { loadAll(); }, [activeProjectId]);

  const getRolFinal = () => form.rol === 'Otro' ? form.rolCustom : form.rol;

  const handleSaveTrabajador = async (e) => {
    e.preventDefault();
    const rolFinal = getRolFinal();
    if (!rolFinal) return;
    setSaving(true);
    try {
      await api.post('/trabajadores', { nombre: form.nombre, rol: rolFinal });
      setShowForm(false);
      setForm({ nombre: '', rol: 'Oficial', rolCustom: '' });
      await loadAll();
      toast.success('Obrero guardado');
    } catch { toast.error('Error al guardar.'); }
    setSaving(false);
  };

  const handleDeleteTrabajador = async (id) => {
    if (!confirm('¿Dar de baja a este obrero?')) return;
    try { await api.delete(`/trabajadores/${id}`); await loadAll(); } catch {}
  };

  const handleAsignar = async (e) => {
    e.preventDefault();
    if (!asigForm.trabajador_id || !asigForm.pago_jornal) return;
    setSaving(true);
    try {
      await api.post('/asignaciones', {
        trabajador_id: Number(asigForm.trabajador_id),
        proyecto_id: activeProjectId,
        pago_jornal: Number(asigForm.pago_jornal),
        fecha_desde: asigForm.fecha_desde
      });
      setShowAsignar(false);
      setAsigForm({ trabajador_id: '', pago_jornal: '', fecha_desde: today() });
      await loadAll();
      toast.success('Obrero asignado');
    } catch { toast.error('Error al asignar.'); }
    setSaving(false);
  };

  const handleUpdateJornal = async (asigId, pago_jornal) => {
    try { await api.put(`/asignaciones/${asigId}`, { pago_jornal: Number(pago_jornal) }); await loadAll(); } catch {}
  };

  const handleDesasignar = async (asigId) => {
    if (!confirm('¿Quitar a este obrero de la obra?')) return;
    try { await api.delete(`/asignaciones/${asigId}`); await loadAll(); } catch {}
  };

  const noAsignados = trabajadores.filter(t => !asignados.find(a => a.trabajador_id === t.id));

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Obreros</h1>
          <p className="text-slate-400 text-sm">{asignados.length} asignado{asignados.length !== 1 ? 's' : ''} a esta obra</p>
        </div>
        <div className="flex gap-2">
          {activeProjectId && (
            <button onClick={() => setShowAsignar(v => !v)} className="flex items-center gap-1.5 border border-blue-600 text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-xl font-semibold text-sm">
              <UserCheck size={16} /> Asignar
            </button>
          )}
          <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl font-semibold text-sm">
            <Plus size={16} /> Nuevo Obrero
          </button>
        </div>
      </div>

      {/* New worker form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-slate-800">Nuevo Obrero</h2>
            <button onClick={() => setShowForm(false)}><X size={20} className="text-slate-400" /></button>
          </div>
          <form onSubmit={handleSaveTrabajador} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="label">Nombre completo *</label>
              <input required className="input" placeholder="Juan García" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
            </div>
            <div>
              <label className="label">Rol *</label>
              <select className="input" value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value }))}>
                {TODOS_ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            {form.rol === 'Otro' && (
              <div>
                <label className="label">Especificar rol</label>
                <input className="input" placeholder="Ej: Plomero" value={form.rolCustom} onChange={e => setForm(p => ({ ...p, rolCustom: e.target.value }))} />
              </div>
            )}
            <div className="md:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-500 font-medium">Cancelar</button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-semibold text-sm">
                {saving ? 'Guardando...' : 'Crear obrero'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Assign to project form */}
      {showAsignar && activeProjectId && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-slate-800">Asignar obrero a esta obra</h2>
            <button onClick={() => setShowAsignar(false)}><X size={20} className="text-slate-400" /></button>
          </div>
          <form onSubmit={handleAsignar} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Obrero *</label>
              <select required className="input" value={asigForm.trabajador_id} onChange={e => setAsigForm(p => ({ ...p, trabajador_id: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {noAsignados.map(t => <option key={t.id} value={t.id}>{t.nombre} ({t.rol})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Jornal diario ($) *</label>
              <input required type="number" min="0" className="input" placeholder="Ej: 15000" value={asigForm.pago_jornal} onChange={e => setAsigForm(p => ({ ...p, pago_jornal: e.target.value }))} />
            </div>
            <div>
              <label className="label">Desde</label>
              <input type="date" className="input" value={asigForm.fecha_desde} onChange={e => setAsigForm(p => ({ ...p, fecha_desde: e.target.value }))} />
            </div>
            <div className="md:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={() => setShowAsignar(false)} className="px-4 py-2 text-slate-500 font-medium">Cancelar</button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-semibold text-sm">
                {saving ? 'Asignando...' : 'Asignar a obra'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('asignados')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'asignados' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
          Esta obra ({asignados.length})
        </button>
        <button onClick={() => setTab('todos')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'todos' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
          Todos ({trabajadores.length})
        </button>
      </div>

      {/* Assigned workers */}
      {tab === 'asignados' && (
        <div className="space-y-2">
          {asignados.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Users size={36} className="mx-auto mb-3 opacity-30" />
              <p>No hay obreros asignados a esta obra.</p>
            </div>
          )}
          {asignados.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
              <div className="bg-slate-100 rounded-xl w-10 h-10 flex items-center justify-center text-slate-500 font-bold text-sm shrink-0">
                {a.nombre?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">{a.nombre}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rolColor(a.rol)}`}>{a.rol}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-xs text-slate-400">Jornal/día</p>
                  <EditableJornal value={a.pago_jornal} onSave={(v) => handleUpdateJornal(a.id, v)} />
                </div>
                <button onClick={() => handleDesasignar(a.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><UserX size={17} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All workers */}
      {tab === 'todos' && (
        <div className="space-y-2">
          {trabajadores.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Users size={36} className="mx-auto mb-3 opacity-30" />
              <p>No hay obreros registrados.</p>
            </div>
          )}
          {trabajadores.map(t => {
            const enObra = asignados.find(a => a.trabajador_id === t.id);
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
                <div className="bg-slate-100 rounded-xl w-10 h-10 flex items-center justify-center text-slate-500 font-bold text-sm shrink-0">
                  {t.nombre?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{t.nombre}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rolColor(t.rol)}`}>{t.rol}</span>
                </div>
                {enObra && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">En esta obra</span>}
                <button onClick={() => handleDeleteTrabajador(t.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={17} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EditableJornal({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const submit = () => { onSave(val); setEditing(false); };
  if (editing) return (
    <div className="flex items-center gap-1">
      <input autoFocus type="number" className="w-20 border border-blue-400 rounded px-1.5 py-0.5 text-sm text-slate-800 outline-none" value={val} onChange={e => setVal(e.target.value)} onBlur={submit} onKeyDown={e => e.key === 'Enter' && submit()} />
    </div>
  );
  return <p className="font-bold text-slate-800 text-sm cursor-pointer hover:text-blue-600" onClick={() => { setVal(value); setEditing(true); }}>${Number(value).toLocaleString('es-AR')}</p>;
}
