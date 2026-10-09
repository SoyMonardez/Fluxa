// Menú de la sesión: estado de la sincronización, instalar la app, contraseña y salir.
import { useState } from 'react';
import { CloudAlert, CloudCheck, CloudOff, CloudUpload, Download, KeyRound, LogOut, RefreshCw, Share } from 'lucide-react';
import { cambiarClave, salir, sincronizarAhora } from '../lib/acciones';
import { avisar, avisarError } from '../lib/avisos';
import { hace } from '../lib/fechas';
import { abrir, cerrar } from '../lib/hojas';
import { esIOS, instalada, instalar, useInstalable } from '../lib/instalar';
import { useEstado } from '../lib/store';
import Hoja from '../ui/Hoja';

function Sincronizacion() {
  const pendientes = useEstado((s) => s.pendientes);
  const red = useEstado((s) => s.red);
  const errorRed = useEstado((s) => s.errorRed);
  const ultima = useEstado((s) => s.ultimaSync);
  const enLinea = useEstado((s) => s.enLinea);
  const [girando, setGirando] = useState(false);
  const errorLocal = useEstado((s) => s.errorLocal);
  const temporal = useEstado((s) => s.almacenTemporal);

  let Icono = CloudCheck;
  let titulo = 'Todo sincronizado';
  let tono = 'bg-ok-suave text-ok';
  if (red === 'subiendo') {
    Icono = CloudUpload;
    titulo = `Subiendo ${pendientes} cambio${pendientes === 1 ? '' : 's'}…`;
    tono = 'bg-info-suave text-info';
  } else if (red === 'error') {
    Icono = CloudAlert;
    titulo = errorRed || 'No se pudo sincronizar';
    tono = 'bg-mal-suave text-mal';
  } else if (pendientes > 0) {
    Icono = CloudOff;
    titulo = `${pendientes} cambio${pendientes === 1 ? '' : 's'} sin subir`;
    tono = 'bg-deuda-suave text-deuda';
  } else if (!enLinea || red === 'sin-senal') {
    Icono = CloudOff;
    titulo = 'Sin señal';
    tono = 'bg-superficie-2 text-tinta-2';
  }

  async function ahora() {
    setGirando(true);
    try {
      await sincronizarAhora();
    } finally {
      setGirando(false);
    }
  }

  return (
    <div className={`rounded-2xl p-3 ${tono}`}>
      <div className="flex items-center gap-3">
        <Icono size={22} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{titulo}</p>
          <p className="text-[13px] opacity-80">{ultima ? `Última sincronización: ${hace(ultima)}` : 'Todavía no se sincronizó'}</p>
        </div>
        <button type="button" className="btn btn-suave h-10 min-h-0 bg-superficie px-3 text-sm text-tinta" disabled={!enLinea || girando} onClick={ahora}>
          <RefreshCw size={16} className={girando || red === 'subiendo' ? 'animate-spin' : ''} /> Ahora
        </button>
      </div>
      <p className="mt-2 text-[13px] leading-snug opacity-80">
        {errorLocal || (temporal ? 'Los cambios sólo duran mientras esta pestaña siga abierta. Sincronizá antes de cerrarla.' : pendientes > 0
          ? 'Están guardados en este teléfono y se suben solos cuando vuelve la señal.'
          : 'Podés usar la app sin señal: todo queda guardado en el teléfono y se sube solo.')}
      </p>
    </div>
  );
}

export default function HojaMenu() {
  const usuario = useEstado((s) => s.sesion?.usuario);
  const pendientes = useEstado((s) => s.pendientes);
  const enLinea = useEstado((s) => s.enLinea);
  const instalable = useInstalable();
  const [cambiando, setCambiando] = useState(false);
  const fila = 'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left font-semibold active:bg-superficie-2 disabled:opacity-45';

  function cerrarSesion() {
    if (pendientes > 0) {
      abrir('confirmar', {
        titulo: 'Hay cambios sin subir',
        texto: `Quedan ${pendientes} cambio${pendientes === 1 ? '' : 's'} guardados en este teléfono que todavía no se subieron. Si cerrás la sesión se pierden. Mejor esperá a tener señal.`,
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
    <Hoja titulo={`Sesión: ${usuario ?? ''}`} subtitulo={enLinea ? 'Con señal' : 'Sin señal'}>
      <Sincronizacion />

      <div className="mt-3 space-y-1">
        {instalable && (
          <button type="button" className={fila} onClick={instalar}>
            <Download size={20} className="text-marca" /> Instalar la app en este teléfono
          </button>
        )}
        <button type="button" className={fila} disabled={!enLinea} onClick={() => setCambiando((v) => !v)}>
          <KeyRound size={20} className="text-tinta-2" /> Cambiar contraseña
          {!enLinea && <span className="ml-auto text-xs font-normal text-tinta-3">necesita señal</span>}
        </button>
        <div className="plegable" data-abierto={cambiando && enLinea} inert={!(cambiando && enLinea)}>
          <div>
            <CambiarClave alTerminar={() => setCambiando(false)} />
          </div>
        </div>
        <button type="button" className={`${fila} text-mal`} onClick={cerrarSesion}>
          <LogOut size={20} /> Cerrar sesión
        </button>
      </div>

      {!instalable && !instalada() && (
        <p className="mt-4 rounded-2xl bg-superficie-2 p-3 text-sm text-tinta-2">
          {esIOS() ? (
            <>
              Para tenerla como app: tocá <Share size={14} className="inline -translate-y-px" /> Compartir y después <b>Agregar a inicio</b>.
            </>
          ) : (
            <>
              Para tenerla como app: en el menú ⋮ del navegador, <b>Instalar app</b> o <b>Agregar a la pantalla principal</b>.
            </>
          )}
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
      avisar('Contraseña cambiada. En los otros teléfonos hay que volver a ingresar.');
      alTerminar();
      cerrar();
    } catch (err) {
      avisarError(err);
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="my-1 space-y-3 rounded-2xl bg-superficie-2 p-3">
      <input className="campo" type="password" autoComplete="current-password" placeholder="Contraseña actual" value={actual} onChange={(e) => setActual(e.target.value)} required />
      <input className="campo" type="password" autoComplete="new-password" placeholder="Nueva (mínimo 6)" minLength={6} value={nueva} onChange={(e) => setNueva(e.target.value)} required />
      <button type="submit" className="btn btn-primario w-full" disabled={enviando}>
        Guardar contraseña
      </button>
    </form>
  );
}
