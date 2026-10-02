import { useSyncExternalStore } from 'react';

export function useMedia(consulta) {
  return useSyncExternalStore(
    (f) => {
      const m = matchMedia(consulta);
      m.addEventListener('change', f);
      return () => m.removeEventListener('change', f);
    },
    () => matchMedia(consulta).matches
  );
}

export const useEscritorio = () => useMedia('(min-width: 768px)');
