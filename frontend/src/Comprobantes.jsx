import React, { useState, useEffect, useRef } from 'react';
import { useGlobal } from './GlobalContext';
import { Upload, FolderOpen, Trash2, Eye, FileText, Image, File, X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from './api';

const CATEGORIAS = ['IVA', 'Ferretería / Áridos', 'Certificados de Obra', 'Pagos a Obreros', 'Otros'];

const CAT_ICONS = {
  'IVA': '🧾',
  'Ferretería / Áridos': '🏗️',
  'Certificados de Obra': '📋',
  'Pagos a Obreros': '💰',
  'Otros': '📁',
};

const CAT_COLORS = {
  'IVA': 'bg-blue-50 border-blue-200 text-blue-700',
  'Ferretería / Áridos': 'bg-orange-50 border-orange-200 text-orange-700',
  'Certificados de Obra': 'bg-green-50 border-green-200 text-green-700',
  'Pagos a Obreros': 'bg-purple-50 border-purple-200 text-purple-700',
  'Otros': 'bg-slate-50 border-slate-200 text-slate-600',
};

const today = () => new Date().toISOString().split('T')[0];

function FileIcon({ mime }) {
  if (mime?.startsWith('image/')) return <Image size={20} className="text-blue-500" />;
  if (mime === 'application/pdf') return <FileText size={20} className="text-red-500" />;
  return <File size={20} className="text-slate-400" />;
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

export default function Comprobantes() {
  const { proyectos, activeProjectId } = useGlobal();
  const [activeTab, setActiveTab] = useState(CATEGORIAS[0]);
  const [comprobantes, setComprobantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ categoria: CATEGORIAS[0], descripcion: '', fecha: today(), proyecto_id: '' });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/comprobantes?categoria=${encodeURIComponent(activeTab)}`);
      setComprobantes(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeTab]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('categoria', uploadForm.categoria);
      fd.append('descripcion', uploadForm.descripcion);
      fd.append('fecha', uploadForm.fecha);
      if (uploadForm.proyecto_id) fd.append('proyecto_id', uploadForm.proyecto_id);
      fd.append('archivo', file); // must be last so req.body fields are parsed before multer destination runs

      await api.post('/comprobantes/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShowUpload(false);
      setFile(null);
      setUploadForm({ categoria: CATEGORIAS[0], descripcion: '', fecha: today(), proyecto_id: '' });
      setActiveTab(uploadForm.categoria);
      await load();
      toast.success('Archivo subido');
    } catch { toast.error('Error al subir archivo. Verificá el formato y tamaño (máx. 50MB).'); }
    setUploading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este comprobante? Se borrará el archivo permanentemente.')) return;
    try { await api.delete(`/comprobantes/${id}`); await load(); } catch {}
  };

  const handleView = async (id) => {
    try {
      const res = await api.get(`/comprobantes/archivo/${id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { toast.error('No se pudo abrir el archivo.'); }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setShowUpload(true); }
  };

  const f = k => e => setUploadForm(p => ({ ...p, [k]: e.target.value }));

  const catCounts = CATEGORIAS.reduce((acc, cat) => {
    acc[cat] = 0;
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Comprobantes</h1>
          <p className="text-slate-400 text-sm">Archivos y documentos de la empresa</p>
        </div>
        <button
          onClick={() => { setShowUpload(v => !v); setUploadForm(p => ({ ...p, categoria: activeTab })); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm"
        >
          <Upload size={16} /> Subir archivo
        </button>
      </div>

      {/* Upload form */}
      {showUpload && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-slate-800">Subir comprobante</h2>
            <button onClick={() => { setShowUpload(false); setFile(null); }}><X size={20} className="text-slate-400" /></button>
          </div>
          <form onSubmit={handleUpload} className="space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
            >
              <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.webp" onChange={e => setFile(e.target.files[0])} />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileIcon mime={file.type} />
                  <div className="text-left">
                    <p className="font-medium text-slate-800 text-sm">{file.name}</p>
                    <p className="text-xs text-slate-400">{formatSize(file.size)}</p>
                  </div>
                  <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }} className="ml-2 text-slate-400 hover:text-red-500"><X size={16} /></button>
                </div>
              ) : (
                <>
                  <Upload size={28} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-slate-500 font-medium text-sm">Tocá para elegir un archivo</p>
                  <p className="text-slate-400 text-xs mt-1">JPG, PNG, PDF, Word, Excel — máx. 50 MB</p>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="label">Carpeta / Categoría *</label>
                <select required className="input" value={uploadForm.categoria} onChange={f('categoria')}>
                  {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Fecha del comprobante</label>
                <input type="date" className="input" value={uploadForm.fecha} onChange={f('fecha')} />
              </div>
              <div>
                <label className="label">Obra (opcional)</label>
                <select className="input" value={uploadForm.proyecto_id} onChange={f('proyecto_id')}>
                  <option value="">General</option>
                  {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Descripción</label>
                <input className="input" placeholder="Ej: Factura 001-234" value={uploadForm.descripcion} onChange={f('descripcion')} />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => { setShowUpload(false); setFile(null); }} className="px-4 py-2 text-slate-500 font-medium">Cancelar</button>
              <button type="submit" disabled={!file || uploading} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-semibold text-sm">
                {uploading ? 'Subiendo...' : 'Subir archivo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category tabs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {CATEGORIAS.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
              activeTab === cat
                ? CAT_COLORS[cat] + ' shadow-sm'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            <span className="text-lg">{CAT_ICONS[cat]}</span>
            <span className="truncate">{cat}</span>
          </button>
        ))}
      </div>

      {/* File list */}
      {loading ? (
        <div className="text-center py-10 text-slate-400">Cargando...</div>
      ) : comprobantes.length === 0 ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`text-center py-16 rounded-2xl border-2 border-dashed transition-colors ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-200 text-slate-400'}`}
        >
          <FolderOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p>Sin archivos en esta carpeta</p>
          <p className="text-sm mt-1 text-slate-300">Arrastrá un archivo aquí o tocá "Subir archivo"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {comprobantes.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex gap-3 hover:border-slate-300 transition-colors">
              <div className="shrink-0 mt-0.5">
                <FileIcon mime={c.mime_type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 text-sm truncate" title={c.nombre_original}>{c.nombre_original}</p>
                {c.descripcion && <p className="text-xs text-slate-400 truncate mt-0.5">{c.descripcion}</p>}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-slate-400">{c.fecha?.split('T')[0]}</span>
                  {c.tamanio && <span className="text-xs text-slate-300">· {formatSize(c.tamanio)}</span>}
                  {c.proyecto_id && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full truncate max-w-[80px]">
                      {proyectos.find(p => p.id === c.proyecto_id)?.nombre || 'Obra'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => handleView(c.id)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Ver archivo">
                  <Eye size={16} />
                </button>
                <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Eliminar">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
