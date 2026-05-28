import React from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useGlobal } from './GlobalContext';
import {
  LayoutDashboard, HardHat, Users, ClipboardCheck,
  ShoppingCart, FolderOpen, LogOut, Building2
} from 'lucide-react';

const NAV = [
  { name: 'Inicio', path: '/', icon: LayoutDashboard },
  { name: 'Obras', path: '/obras', icon: HardHat },
  { name: 'Obreros', path: '/obreros', icon: Users },
  { name: 'Asistencia', path: '/asistencia', icon: ClipboardCheck },
  { name: 'Proveedores', path: '/proveedores', icon: ShoppingCart },
  { name: 'Comprobantes', path: '/comprobantes', icon: FolderOpen },
];

const PAGES_WITHOUT_PROJECT = ['/', '/obras', '/proveedores', '/comprobantes'];

export default function Layout() {
  const { proyectos, activeProjectId, setActiveProjectId, activeProject } = useGlobal();
  const location = useLocation();

  const needsProject = !PAGES_WITHOUT_PROJECT.includes(location.pathname);
  const noProject = needsProject && !activeProjectId;

  const logout = () => {
    localStorage.removeItem('etem_token');
    window.location.href = '/login';
  };

  const activeClass = 'bg-blue-600 text-white shadow-sm';
  const inactiveClass = 'text-slate-600 hover:bg-slate-100';

  return (
    <div className="bg-slate-50 min-h-screen md:flex md:h-screen md:overflow-hidden">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-60 bg-white border-r border-slate-200 flex-col shrink-0">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building2 className="text-blue-600" size={26} />
            <div>
              <h1 className="text-xl font-bold text-slate-800 leading-none">ETEM</h1>
              <p className="text-xs text-slate-400 mt-0.5">Gestión de Obras</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 border-b border-slate-100">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
            Obra activa
          </label>
          <select
            value={activeProjectId || ''}
            onChange={e => setActiveProjectId(Number(e.target.value))}
            className="w-full border border-slate-300 rounded-lg p-2 text-sm text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="" disabled>Seleccionar obra...</option>
            {proyectos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(({ name, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive ? activeClass : inactiveClass}`
              }
            >
              <Icon size={19} />
              {name}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors"
          >
            <LogOut size={19} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col md:min-h-0 md:overflow-hidden">

        {/* Mobile Top Bar */}
        <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="text-blue-600" size={22} />
              <span className="font-bold text-slate-800 text-lg">ETEM</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide leading-none mb-0.5">Obra activa</span>
              <select
                value={activeProjectId || ''}
                onChange={e => setActiveProjectId(Number(e.target.value))}
                className="border border-slate-300 rounded-lg px-2 py-1 text-sm text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none max-w-[160px]"
              >
                <option value="" disabled>Seleccionar...</option>
                {proyectos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 md:overflow-y-auto pb-24 md:pb-0 bg-slate-50">
          {noProject ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <HardHat size={56} className="text-slate-300 mb-4" />
              <h2 className="text-xl font-semibold text-slate-600 mb-2">Seleccioná una obra</h2>
              <p className="text-slate-400 mb-6">Elegí una obra en el menú de arriba para continuar.</p>
              {proyectos.length === 0 && (
                <Link to="/obras" className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm">
                  Crear primera obra
                </Link>
              )}
            </div>
          ) : (
            <Outlet />
          )}
        </main>

        {/* ── Mobile Bottom Nav ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-50">
          {NAV.map(({ name, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-blue-600' : 'text-slate-400'
                }`
              }
            >
              <Icon size={20} />
              {name}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
