// Sugerencia de instalar la app (una vez; si se descarta, vuelve al mes).
import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { esIOS, instalada, instalar, useInstalable } from '../lib/instalar';
import { Marca } from './pagina';

const CLAVE = 'etem_instalar_visto';
const UN_MES = 30 * 24 * 3600 * 1000;

function descartadoHace() {
  try {
    return Date.now() - Number(localStorage.getItem(CLAVE) || 0);
  } catch {
    return 0;
  }
}

function descartar() {
  try {
    localStorage.setItem(CLAVE, String(Date.now()));
  } catch {
    /* nada */
  }
}

export default function BannerInstalar() {
  const aviso = useInstalable();
  const [visible, setVisible] = useState(false);
  const ios = esIOS();

  useEffect(() => {
    if (instalada() || descartadoHace() < UN_MES) return undefined;
    const t = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(t);
  }, []);

  if (!visible || (!aviso && !ios)) return null;

  function cerrar() {
    descartar();
    setVisible(false);
  }

  return (
    <div className="animar-subir fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md md:bottom-6">
      <div className="tarjeta flex items-center gap-3 p-3 shadow-[var(--sombra-alta)]">
        <Marca tam={44} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-tight font-bold">Instalá ETEM en el teléfono</p>
          <p className="mt-0.5 text-[13px] leading-snug text-tinta-2">
            {aviso ? (
              'Se abre al toque y funciona sin señal.'
            ) : (
              <>
                Tocá <Share size={13} className="inline -translate-y-px" /> Compartir y después <b>Agregar a inicio</b>.
              </>
            )}
          </p>
        </div>
        {aviso && (
          <button
            type="button"
            className="btn btn-marca h-10 min-h-0 px-3 text-sm"
            onClick={async () => {
              await instalar();
              cerrar();
            }}
          >
            <Download size={17} /> Instalar
          </button>
        )}
        <button type="button" aria-label="Ahora no" onClick={cerrar} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-tinta-3 active:bg-superficie-2">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
