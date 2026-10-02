import { LazyMotion, MotionConfig } from 'motion/react';
import { useEstado } from './lib/store';
import Login from './shell/Login';
import Shell from './shell/Shell';
import HojaMenu from './shell/HojaMenu';
import Avisos from './ui/Avisos';
import Hojas from './ui/Hojas';
import { registrarHojas } from './lib/hojas';
import HojaConfirmar from './ui/HojaConfirmar';
import HojaJornada from './secciones/asistencia/HojaJornada';
import HojaFicha from './secciones/obreros/HojaFicha';
import HojaAdelanto from './secciones/obreros/HojaAdelanto';
import HojaElegirObrero from './secciones/obreros/HojaElegirObrero';
import HojaObreroForm from './secciones/obreros/HojaObreroForm';
import HojaConfirmarPago from './secciones/pagos/HojaConfirmarPago';
import HojaDetallePago from './secciones/pagos/HojaDetallePago';
import HojaCuadrilla from './secciones/cuadrillas/HojaCuadrilla';
import HojaCuadrillaForm from './secciones/cuadrillas/HojaCuadrillaForm';
import HojaIntegrantes from './secciones/cuadrillas/HojaIntegrantes';
import HojaEncargado from './secciones/cuadrillas/HojaEncargado';
import HojaEntregar from './secciones/cuadrillas/HojaEntregar';
import HojaHerramienta from './secciones/herramientas/HojaHerramienta';
import HojaHerramientaForm from './secciones/herramientas/HojaHerramientaForm';
import HojaMover from './secciones/herramientas/HojaMover';
import HojaReclamo from './secciones/herramientas/HojaReclamo';
import HojaSumar from './secciones/herramientas/HojaSumar';

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

const animaciones = () => import('./lib/animaciones').then((m) => m.default);

export default function App() {
  const sesion = useEstado((s) => s.sesion);
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={animaciones} strict>
        {sesion ? <Shell /> : <Login />}
        <Hojas />
        <Avisos />
      </LazyMotion>
    </MotionConfig>
  );
}
