import { createContext } from 'react';

/** { saliendo, reemplazo } de la hoja que se está dibujando (ver Hojas.jsx). */
export const EstadoHoja = createContext({ saliendo: false, reemplazo: false });
