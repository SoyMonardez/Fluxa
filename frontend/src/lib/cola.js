// Cola de asistencia sin señal: cada marca se guarda en el teléfono (la última
// por obrero y día gana) y se sube sola cuando vuelve la conexión.
const CLAVE = 'etem_cola_asistencia';

const clave = (m) => `${m.obrero_id}|${m.fecha}`;

function leer() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || '{}');
  } catch {
    return {};
  }
}

function escribir(cola) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(cola));
  } catch {
    /* nada */
  }
}

export function encolar(marca) {
  const cola = leer();
  cola[clave(marca)] = marca;
  escribir(cola);
  return Object.keys(cola).length;
}

export function sacar(marca) {
  const cola = leer();
  if (!(clave(marca) in cola)) return Object.keys(cola).length;
  delete cola[clave(marca)];
  escribir(cola);
  return Object.keys(cola).length;
}

export const marcasEnCola = () => Object.values(leer());
export const largoCola = () => Object.keys(leer()).length;
export const vaciarCola = () => escribir({});
