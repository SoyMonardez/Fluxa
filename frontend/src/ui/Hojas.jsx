// Dibuja la pila de hojas abiertas.
import { useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { cerrar, componenteDe, hayHojas, usePila } from '../lib/hojas';

export default function Hojas() {
  const pila = usePila();

  useEffect(() => {
    document.documentElement.style.overflow = pila.length ? 'hidden' : '';
  }, [pila.length]);

  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key === 'Escape' && hayHojas()) cerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, []);

  return (
    <AnimatePresence>
      {pila.map((h) => {
        const Componente = componenteDe(h.tipo);
        return Componente ? <Componente key={h.id} {...h.props} /> : null;
      })}
    </AnimatePresence>
  );
}
