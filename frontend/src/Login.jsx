import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Building2 } from 'lucide-react';
import api from './api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('etem_token', data.token);
      navigate('/');
    } catch {
      setError('Usuario o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 rounded-2xl p-3 mb-3">
            <Building2 className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-800">ETEM</h1>
          <p className="text-slate-400 text-sm mt-1">Gestión de Obras</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 mb-5 rounded-xl text-sm text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1.5">Usuario</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                type="text"
                required
                autoComplete="username"
                placeholder="admin"
                className="w-full border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-base text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1.5">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                type="password"
                required
                autoComplete="current-password"
                className="w-full border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-base text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-xl text-base transition-colors mt-2"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
