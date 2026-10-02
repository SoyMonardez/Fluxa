// P5: día de pago. Próximo pago (corte viernes) e historial.
import { useState } from 'react';
import { Segmentos } from '../../ui/campos';
import { Contenido, Encabezado } from '../../ui/pagina';
import Historial from './Historial';
import ProximoPago from './ProximoPago';

export default function Pagos() {
  const [vista, setVista] = useState('proximo');
  return (
    <>
      <Encabezado titulo="Pagos" subtitulo="Se paga el viernes la semana de sábado a viernes">
        <Segmentos
          id="pagos"
          className="mt-2"
          valor={vista}
          onCambio={setVista}
          opciones={[
            { valor: 'proximo', texto: 'Próximo pago' },
            { valor: 'historial', texto: 'Historial' },
          ]}
        />
      </Encabezado>
      <Contenido>{vista === 'proximo' ? <ProximoPago /> : <Historial />}</Contenido>
    </>
  );
}
