// Dibuja la pila de hojas abiertas (y las que se están cerrando).
import { Suspense, useEffect } from 'react';
import { cerrar, componenteDe, hayHojas, useHayHojas, usePila } from '../lib/hojas';
import { EstadoHoja } from './estadoHoja';

export default function Hojas() {
  const pila = usePila();
  const abiertas = useHayHojas();

  useEffect(() => {
    document.documentElement.style.overflow = abiertas ? 'hidden' : '';
  }, [abiertas]);

  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key === 'Escape' && hayHojas()) cerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, []);

  return pila.map((h) => {
    const Componente = componenteDe(h.tipo);
    if (!Componente) return null;
    return (
      <EstadoHoja.Provider key={h.id} value={{ saliendo: Boolean(h.saliendo), reemplazo: Boolean(h.reemplazo) }}>
        <Suspense fallback={null}>
          <Componente {...h.props} />
        </Suspense>
      </EstadoHoja.Provider>
    );
  });
}
