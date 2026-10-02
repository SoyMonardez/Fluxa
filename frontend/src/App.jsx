import { useEstado } from './lib/store';
import { registrarHojas } from './lib/hojas';
import { perezoso } from './lib/perezoso';
import Login from './shell/Login';
import Shell from './shell/Shell';
import HojaMenu from './shell/HojaMenu';
import Avisos from './ui/Avisos';
import Hojas from './ui/Hojas';
import HojaConfirmar from './ui/HojaConfirmar';
import HojaJornada from './secciones/asistencia/HojaJornada';
import HojaFicha from './secciones/obreros/HojaFicha';
import HojaAdelanto from './secciones/obreros/HojaAdelanto';
import HojaElegirObrero from './secciones/obreros/HojaElegirObrero';

// Lo que se usa al pasar lista va en el paquete principal; el resto, aparte.
const HojaObreroForm = perezoso(() => import('./secciones/obreros/HojaObreroForm'));
const HojaConfirmarPago = perezoso(() => import('./secciones/pagos/HojaConfirmarPago'));
const HojaDetallePago = perezoso(() => import('./secciones/pagos/HojaDetallePago'));
const HojaCuadrilla = perezoso(() => import('./secciones/cuadrillas/HojaCuadrilla'));
const HojaCuadrillaForm = perezoso(() => import('./secciones/cuadrillas/HojaCuadrillaForm'));
const HojaIntegrantes = perezoso(() => import('./secciones/cuadrillas/HojaIntegrantes'));
const HojaEncargado = perezoso(() => import('./secciones/cuadrillas/HojaEncargado'));
const HojaEntregar = perezoso(() => import('./secciones/cuadrillas/HojaEntregar'));
const HojaHerramienta = perezoso(() => import('./secciones/herramientas/HojaHerramienta'));
const HojaHerramientaForm = perezoso(() => import('./secciones/herramientas/HojaHerramientaForm'));
const HojaMover = perezoso(() => import('./secciones/herramientas/HojaMover'));
const HojaReclamo = perezoso(() => import('./secciones/herramientas/HojaReclamo'));
const HojaSumar = perezoso(() => import('./secciones/herramientas/HojaSumar'));

registrarHojas({
  menu: HojaMenu,
  confirmar: HojaConfirmar,
  jornada: HojaJornada,
  ficha: HojaFicha,
  adelanto: HojaAdelanto,
  elegirObrero: HojaElegirObrero,
  obreroForm: HojaObreroForm,
  confirmarPago: HojaConfirmarPago,
  detallePago: HojaDetallePago,
  cuadrilla: HojaCuadrilla,
  cuadrillaForm: HojaCuadrillaForm,
  integrantes: HojaIntegrantes,
  encargado: HojaEncargado,
  entregar: HojaEntregar,
  herramienta: HojaHerramienta,
  herramientaForm: HojaHerramientaForm,
  mover: HojaMover,
  reclamo: HojaReclamo,
  sumarUnidades: HojaSumar,
});

export default function App() {
  const sesion = useEstado((s) => s.sesion);
  const vencida = useEstado((s) => s.sesionVencida);
  return (
    <>
      {sesion ? <Shell /> : <Login />}
      {sesion && vencida && <Login vencida />}
      <Hojas />
      <Avisos />
    </>
  );
}
