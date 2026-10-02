import { useState, useSyncExternalStore } from 'react';
import { CloudOff, Download, KeyRound, LogOut, RefreshCw } from 'lucide-react';
import { cambiarClave, salir, subirCola } from '../lib/acciones';
import { avisar, avisarError } from '../lib/avisos';
import { abrir, cerrar } from '../lib/hojas';
import { useEstado } from '../lib/store';
import Hoja from '../ui/Hoja';

// El navegador avisa cuando la app se puede instalar; se guarda ese aviso para usarlo desde el menú.
let avisoInstalar = null;
const subs = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    avisoInstalar = e;
    subs.forEach((f) => f());
  });
}
const useInstalable = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => avisoInstalar
  );

export default function HojaMenu() {
  const usuario = useEstado((s) => s.sesion?.usuario);
  const cola = useEstado((s) => s.cola);
  const enLinea = useEstado((s) => s.enLinea);
  const instalable = useInstalable();
  const [cambiando, setCambiando] = useState(false);

  const fila = 'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left font-semibold active:bg-superficie-2';

  function cerrarSesion() {
    if (cola > 0) {
      abrir('confirmar', {
        titulo: 'Hay asistencia sin subir',
        texto: `Quedan ${cola} marca(s) guardadas en este teléfono que todavía no se subieron. Si cerrás la sesión se pierden.`,
        confirmar: 'Cerrar igual',
        peligro: true,
        onConfirmar: () => {
          salir();
          return 0;
        },
      });
      return;
    }
    salir();
  }

  return (
    <Hoja titulo={`Sesión: ${usuario ?? ''}`} subtitulo={enLinea ? 'Conectado' : 'Sin conexión'}>
      {cola > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-deuda-suave p-3 text-deuda">
          <CloudOff size={20} className="shrink-0" />
          <p className="flex-1 text-sm font-medium">{cola} marca(s) de asistencia guardadas en el teléfono, esperando señal.</p>
          <button type="button" className="btn btn-suave min-h-0 px-3 py-2 text-sm" onClick={() => subirCola()}>
            <RefreshCw size={16} /> Subir
          </button>
        </div>
      )}

      <div className="space-y-1">
        {instalable && (
          <button
            type="button"
            className={fila}
            onClick={async () => {
              instalable.prompt();
              await instalable.userChoice.catch(() => null);
              avisoInstalar = null;
              subs.forEach((f) => f());
            }}
          >
            <Download size={20} className="text-marca" /> Instalar la app en este teléfono
          </button>
        )}
        <button type="button" className={fila} onClick={() => setCambiando((v) => !v)}>
          <KeyRound size={20} className="text-tinta-2" /> Cambiar contraseña
        </button>
        {cambiando && <CambiarClave alTerminar={() => setCambiando(false)} />}
        <button type="button" className={`${fila} text-mal`} onClick={cerrarSesion}>
          <LogOut size={20} /> Cerrar sesión
        </button>
      </div>

      {!instalable && (
        <p className="mt-4 rounded-2xl bg-superficie-2 p-3 text-sm text-tinta-2">
          Tip: para tenerla como app, en Android tocá ⋮ → <b>Instalar app</b>; en iPhone, Compartir → <b>Agregar a inicio</b>.
        </p>
      )}
    </Hoja>
  );
}

function CambiarClave({ alTerminar }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    try {
      await cambiarClave(actual, nueva);
      avisar('Contraseña cambiada');
      alTerminar();
      cerrar();
    } catch (err) {
      avisarError(err);
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-3 rounded-2xl bg-superficie-2 p-3">
      <input className="campo" type="password" autoComplete="current-password" placeholder="Contraseña actual" value={actual} onChange={(e) => setActual(e.target.value)} required />
      <input className="campo" type="password" autoComplete="new-password" placeholder="Nueva (mínimo 6)" minLength={6} value={nueva} onChange={(e) => setNueva(e.target.value)} required />
      <button type="submit" className="btn btn-primario w-full" disabled={enviando}>
        Guardar contraseña
      </button>
    </form>
  );
}
