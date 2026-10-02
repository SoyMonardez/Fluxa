// Vibración corta al tocar (Android). En iOS no existe y no pasa nada.
export function vibrar(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* sin soporte */
  }
}
