// Service worker: guarda la app en el teléfono para abrirla sin señal. Cuando
// hay una versión nueva no recarga de golpe (podés estar en medio de algo):
// avisa y se actualiza cuando lo tocás.
import { registerSW } from 'virtual:pwa-register';
import { avisar } from './avisos';

const UNA_HORA = 60 * 60 * 1000;

if ('serviceWorker' in navigator) {
  const actualizar = registerSW({
    immediate: true,
    onNeedRefresh() {
      avisar('Hay una versión nueva de la app.', { accion: { texto: 'Actualizar', fn: () => actualizar(true) }, duracion: 60_000 });
    },
    onOfflineReady() {
      avisar('Listo: la app ya funciona sin señal en este teléfono.', { duracion: 4000 });
    },
    onRegisteredSW(_url, registro) {
      // Mientras la app queda abierta, se fija cada tanto si hay versión nueva.
      if (registro) setInterval(() => navigator.onLine && registro.update().catch(() => {}), UNA_HORA);
    },
  });
}
