// Ingreso. Con "vencida" se muestra encima de la app: lo hecho sigue guardado en
// el teléfono y se sube al volver a entrar.
import { useState } from 'react';
import { Eye, EyeOff, Lock, UserRound } from 'lucide-react';
import { ingresar } from '../lib/acciones';
import { leerUsuario } from '../lib/api';
import { useEstado } from '../lib/store';
import { Marca } from '../ui/pagina';

export default function Login({ vencida = false }) {
  const pendientes = useEstado((s) => s.pendientes);
  const [usuario, setUsuario] = useState(() => leerUsuario() || '');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await ingresar(usuario.trim(), clave);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <div className={`pt-seguro pb-seguro grid min-h-dvh place-items-center px-5 ${vencida ? 'animar-aparecer fixed inset-0 z-[70] overflow-y-auto bg-fondo' : ''}`}>
      <div className="animar-subir w-full max-w-sm py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="animar-crecer" style={{ animationDelay: '0.05s' }}>
            <Marca tam={68} />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">ETEM</h1>
          <p className="mt-1 text-tinta-2">{vencida ? 'La sesión venció: volvé a ingresar' : 'Asistencia, pagos y herramientas'}</p>
        </div>

        {vencida && pendientes > 0 && (
          <p className="mb-4 rounded-2xl bg-deuda-suave px-4 py-3 text-sm text-deuda">
            Tenés {pendientes} cambio{pendientes === 1 ? '' : 's'} guardado{pendientes === 1 ? '' : 's'} en el teléfono. Se suben solos apenas ingreses.
          </p>
        )}

        <form onSubmit={enviar} className="tarjeta space-y-4 p-5">
          <div>
            <label htmlFor="usuario" className="etiqueta">
              Usuario
            </label>
            <div className="relative">
              <UserRound size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-tinta-3" />
              <input
                id="usuario"
                className="campo pl-10"
                autoComplete="username"
                autoCapitalize="none"
                required
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="admin"
              />
            </div>
          </div>
          <div>
            <label htmlFor="clave" className="etiqueta">
              Contraseña
            </label>
            <div className="relative">
              <Lock size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-tinta-3" />
              <input
                id="clave"
                className="campo pr-11 pl-10"
                type={verClave ? 'text' : 'password'}
                autoComplete="current-password"
                autoFocus={vencida}
                required
                value={clave}
                onChange={(e) => setClave(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setVerClave((v) => !v)}
                aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute top-1/2 right-1.5 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-tinta-3"
              >
                {verClave ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && <p className="animar-aparecer rounded-xl bg-mal-suave px-3 py-2 text-sm font-medium text-mal">{error}</p>}
          <button type="submit" className="btn btn-primario w-full" disabled={enviando}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
