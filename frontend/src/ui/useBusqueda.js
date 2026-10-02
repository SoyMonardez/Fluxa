import { useId, useState } from 'react';
import { flushSync } from 'react-dom';

/** Buscador que se abre desde el encabezado. El foco se da en el mismo toque (así iOS abre el teclado). */
export function useBusqueda() {
  const [buscando, setBuscando] = useState(false);
  const [texto, setTexto] = useState('');
  const id = useId();

  function alternar() {
    const campo = () => document.getElementById(id);
    if (buscando) {
      setBuscando(false);
      setTexto('');
      campo()?.blur();
      return;
    }
    flushSync(() => setBuscando(true));
    campo()?.focus();
  }

  return { buscando, texto, setTexto, alternar, id };
}
