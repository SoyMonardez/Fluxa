# Fluxa / ETEM — Diseño del sistema

Este documento se escribió **antes** de programar, en el orden que pediste:
primero los **patrones de uso**, después los **flujos**, y recién ahí las
**funcionalidades** (reglas, datos y pantallas). Todo lo que está acá está
implementado en la app.

---

## 0. Qué reemplaza y qué se descartó

### Lo que hoy está en el cuaderno → dónde queda en la app

| En papel hoy | En la app |
|---|---|
| Lista de obreros con su sueldo por día | **Obreros**: nombre, rol, jornal ($/día), teléfono, cuadrilla |
| Asistencia general (no por obra) marcada con tilde | **Asistencia**: un tilde por obrero por día, para toda la empresa |
| Medio día más / doble jornada | Jornada **½ · 1 · 1½ · 2** en el mismo tilde |
| Adelantos que piden | **Adelanto** desde la lista de asistencia o la ficha del obrero |
| Cuentas del viernes | **Pagos**: semana sábado→viernes, total a pagar, descuento de adelantos ahora o después |
| Lista de herramientas y máquinas de la empresa | **Herramientas** (pañol): inventario con cantidades |
| Qué herramienta se llevó cada obra y quién responde | **Cuadrillas**: integrantes, **encargado**, herramientas y reclamos |

### Lo que se sacó del sistema anterior (no se usaba)

- Obras con clientes e ingresos, **Proveedores**, **Comprobantes** (subida de archivos),
  **Dashboard** con gráficos y la página de Finanzas (que ni estaba conectada).
- Asistencia **por obra** y sueldo **por asignación a obra** (vos tomás asistencia general
  y cada obrero tiene un único jornal).
- Código muerto (`AttendanceMatrix.jsx`, `Finanzas.jsx`, `routes/finanzas.js`), restos de la
  plantilla de Vite y dependencias sin uso: axios, recharts, react-router, react-hot-toast,
  clsx, tailwind-merge, react-is, multer, cors.
- Las tablas viejas **no se borran**: al arrancar, el sistema las renombra a `legacy_*`
  (ver §6.3). Si no las necesitás, se pueden eliminar a mano.

---

## 1. Quién la usa y en qué contexto

- **Usuario principal**: el dueño / administrador. Usa la app **casi siempre desde el
  celular**, parado, en la obra o en el auto, muchas veces con una sola mano y con sol.
- **Señal**: a veces mala en obra → lo frecuente (pasar lista) tiene que funcionar
  sin conexión y sincronizar solo.
- **Volumen**: de 10 a 60 obreros, varias cuadrillas, cientos de herramientas.

De ahí salen los principios de diseño:

1. **Lo frecuente, a un toque.** Pasar lista y dar un adelanto no pueden tener formularios.
2. **Una sección resuelve varias cosas.** Desde Asistencia se marca, se ajusta la jornada,
   se ve cuánto le queda a cada uno y se da un adelanto, sin cambiar de pantalla.
3. **Siempre a la vista "cuánto"**: lo que lleva ganado, lo que pidió y lo que le queda.
4. **Nada se pierde**: todo se puede deshacer o anular, y lo pagado queda bloqueado.
5. **Pulgar primero**: navegación abajo, botones grandes (≥ 44 px), paneles que suben
   desde abajo y se cierran arrastrando.

---

## 2. Patrones de uso

| # | Patrón | Frecuencia | Contexto | Qué necesita | Meta |
|---|---|---|---|---|---|
| P1 | **Pasar lista** | Diario (mañana) | En obra o recibiendo mensajes de los encargados | Marcar a todos rápido y desmarcar a los que faltan | < 30 s para 20 obreros |
| P2 | **Ajustar jornada** | Varias por semana | Mismo momento que P1 o a la tarde | Poner ½, 1½ (medio día más) o doble | 2 toques |
| P3 | **Dar un adelanto** | Varias por semana, en cualquier momento | Le piden plata en la obra | Encontrar al obrero, ver si le alcanza, anotar el monto | < 10 s |
| P4 | **Consultar cuánto le queda** | Diario | "¿Cuánto me queda para el viernes?" | Ganado sin pagar − adelantos | 0 toques (visible en la lista) |
| P5 | **Día de pago** | Semanal (viernes) | Oficina o auto, armando los sobres | Total a juntar, detalle por obrero, decidir descuento de adelantos, plus, confirmar y compartir | < 2 min |
| P6 | **Repartir herramientas** | Semanal / al arrancar obra | En el pañol o en la obra | Mandar varias herramientas a una cuadrilla, mover entre obras, devolver | 1 pantalla |
| P7 | **Reclamo** | Ocasional | Se robaron, falta o se rompió algo | Registrar a nombre del encargado y, si corresponde, cobrárselo | 1 panel |
| P8 | **¿Dónde está tal herramienta?** | Ocasional | Alguien pide una máquina | Buscar y ver en qué obra está y quién responde | Búsqueda |
| P9 | **Altas y cambios de personal** | Ocasional | Entra alguien nuevo / aumento | Cargar nombre + rol + jornal; cambiar jornal | 1 formulario |
| P10 | **Armar cuadrillas** | Al arrancar obra | Planificación | Nombre de la obra, integrantes, encargado | 1 pantalla |

---

## 3. Mapa de la app

Barra inferior fija con 5 secciones (la app abre en **Asistencia**, lo más usado):

```
┌──────────┬────────┬────────────┬──────────────┬──────────┐
│Asistencia│ Pagos  │ Cuadrillas │ Herramientas │ Obreros  │
└──────────┴────────┴────────────┴──────────────┴──────────┘
```

| Sección | Qué se puede hacer desde ahí (sin salir) |
|---|---|
| **Asistencia** | Ver el día o la semana · tilde por obrero · "Todos ✓" por cuadrilla · jornada ½/1/1½/2 · ver *lleva / adelantos / le queda* · dar adelanto · buscar · cambiar de día deslizando |
| **Pagos** | Próximo pago (corte viernes) · total a pagar · detalle por obrero con los días · descontar adelantos ahora o después (o una parte) · plus · excluir a alguien · confirmar · compartir por WhatsApp · historial · anular un pago |
| **Cuadrillas** | Crear cuadrilla (obra) · integrantes · elegir encargado · entregar herramientas del pañol · devolver / mover a otra obra · reclamo (robo, faltante, rotura) · historial · cerrar cuadrilla |
| **Herramientas** | Inventario de herramientas y máquinas · cantidades por lugar (pañol y obras) · enviar a una obra · sumar unidades · reclamo · movimientos |
| **Obreros** | Alta rápida (con "guardar y agregar otro") · editar jornal/rol/cuadrilla · ficha con cuenta (días sin pagar, adelantos, pagos) · adelanto · WhatsApp / llamar · dar de baja / reactivar |

Paneles (se abren desde abajo, se cierran arrastrando hacia abajo o con el botón *atrás*
del celular): ficha rápida del obrero, jornada, adelanto, formularios, reparto de
herramientas, reclamo, confirmación de pago.

---

## 4. Flujos

### F1 · Pasar lista (P1)
1. Abrís la app → **Asistencia** de hoy, obreros agrupados por cuadrilla.
2. En cada cuadrilla tocás **Todos ✓** → se marcan todos con 1 jornal (animación en cascada).
3. Tocás el tilde de los que faltaron para desmarcarlos.
4. Arriba ves "**14 de 16 presentes · $ 630.000 hoy**".

*Toques: 1 por cuadrilla + 1 por falta.* Si no hay señal, los tildes quedan guardados en
el teléfono (icono de nube) y se suben solos al volver la conexión.

### F2 · Medio día más / doble jornada (P2)
1. **Mantené apretado** el tilde (o tocá el chip de jornada que aparece al lado).
2. Elegís **½ · 1 · 1½ · 2** (o **Falta**). Opcional: nota ("se quedó a hormigonar").
3. El tilde muestra la marca (½, 1½, 2) y el total del día se actualiza.

### F3 · Adelanto (P3)
- **Desde Asistencia**: tocás el nombre → ficha rápida con *lleva $X · adelantos $Y ·
  le queda $Z* → **Dar adelanto** → monto (teclado numérico + atajos que suman +5.000 /
  +10.000 / +20.000 / +50.000) → **Anotar**. Aviso "Adelanto de $X a Juan · **Deshacer**".
- **Botón flotante "Adelanto"** (en Asistencia): elegís obrero (con buscador) → monto → Guardar.
- Si el adelanto supera lo que lleva ganado, la app lo avisa en ámbar (no lo impide).

### F4 · ¿Cuánto le queda? (P4)
Cada fila de Asistencia muestra: **días sin pagar · lleva $ · adel. $ · le queda $**.
En la ficha del obrero está el detalle: días, adelantos (cuáles ya se descontaron) y pagos.

### F5 · Día de pago (P5)
1. **Pagos** muestra el corte "**Pago del viernes 2/10**" (semana sáb 26/9 → vie 2/10).
   Si quedaron días sin pagar de semanas anteriores, se suman solos y se marcan.
2. Arriba: **Total a pagar**, ganado, descuentos y plus, cantidad de jornales.
3. Cada obrero: días de la semana (S D L M M J V), jornales × jornal = ganado.
   Si tiene adelantos, tocás su fila y elegís **Descontar** (todo) · **Una parte** (monto) ·
   **Después** (pasa al próximo pago).
4. Opcional: **Plus** (ese "poquito más") con nota; o **excluir** a alguien de este pago
   (sus días quedan para el próximo).
5. **Pagar $ X** → resumen (cuántos obreros, total, adelantos descontados y los que quedan
   pendientes) → **Confirmar pago**.
6. Listo: los días quedan **pagados y bloqueados**. **Compartir** manda el resumen por
   WhatsApp; desde el historial podés mandar el recibo a cada obrero o **anular** el pago.

### F6 · Repartir herramientas (P6)
- **Cuadrillas → Plaza Funes → Entregar herramientas**: lista del pañol con buscador,
  tocás para sumar (+1) o usás − / + → **Entregar N herramientas**. Queda registrado a
  nombre del encargado y con fecha.
- En cada herramienta de la cuadrilla: **Devolver al pañol**, **Mover a otra cuadrilla** o
  **Reclamo**.
- Desde **Herramientas** también: tocás una herramienta → **Enviar a…** cuadrilla + cantidad.

### F7 · Reclamo: robo, faltante o rotura (P7)
1. En la herramienta (dentro de la cuadrilla o en Herramientas) → **Reclamo**.
2. Tipo: **Robo · Faltante · Rotura por mal uso**, cantidad, nota.
3. Se muestra **quién responde** (el encargado de la cuadrilla).
4. Opcional: **Cobrarle $** (sugiere el valor de la herramienta × cantidad) a él u otro
   integrante → queda como **cargo** en su cuenta y se descuenta el viernes como un adelanto.
5. Esas unidades salen del inventario. Si aparece o se arregla: **Sumar unidades**.

### F8 · ¿Dónde está? (P8)
**Herramientas** → buscador → cada ítem muestra la barra de reparto
"3 en pañol · 2 Plaza Funes · 1 Roldán" y en el detalle, quién es el encargado de cada obra.

### F9 · Alta de obrero (P9)
**Obreros → +** → nombre, rol (chips: Capataz / Oficial / Medio oficial / Ayudante),
jornal $/día, cuadrilla, teléfono → **Guardar** o **Guardar y agregar otro**
(para cargar a todos de una vez).

### F10 · Armar cuadrilla (P10)
**Cuadrillas → +** → nombre (ej. "Plaza Funes"), dirección/obra, color →
**Integrantes** (selección múltiple; si alguien estaba en otra cuadrilla, se lo mueve) →
**Encargado** (uno de los integrantes) → **Entregar herramientas**.
Una cuadrilla sin encargado se marca en rojo: *"Falta encargado"*.

---

## 5. Reglas de negocio

| # | Regla |
|---|---|
| R1 | **Semana de pago = sábado a viernes**, se paga el viernes. (Si se trabaja un sábado, se cobra el viernes siguiente.) |
| R2 | Día trabajado = **½, 1, 1½ o 2 jornales**. **Falta = no se paga** (no se registra nada). |
| R3 | Ganado = jornales × **jornal del obrero** (cada uno tiene el suyo). Se toma el jornal vigente al pagar y queda guardado en el pago. |
| R4 | **Adelantos y cargos** forman la *deuda* del obrero. En cada pago se decide cuánto descontar: por defecto todo lo posible (sin pasar lo ganado); lo que no se descuenta **pasa al próximo pago**. |
| R5 | **A pagar = ganado + plus − descuento.** |
| R6 | Lo pagado queda **bloqueado**. Para corregir un día pagado se **anula el pago** (todo vuelve a estar pendiente, también la deuda). |
| R7 | Días sin pagar de semanas anteriores **se incluyen solos** en el próximo pago. Un día que se marca tarde (de una semana ya pagada) se paga el viernes siguiente. |
| R8 | Cada cuadrilla tiene **un encargado** (uno de sus integrantes) que responde por sus herramientas. Cada entrega y cada reclamo quedan registrados con el encargado de ese momento. |
| R9 | Inventario: **total = pañol + lo que tiene cada cuadrilla**. Un reclamo da de baja esas unidades. |
| R10 | **Cerrar una cuadrilla** devuelve todas sus herramientas al pañol y deja a sus integrantes sin cuadrilla. |
| R11 | Un obrero **dado de baja** no aparece en Asistencia; si le quedan días sin pagar, sigue apareciendo en Pagos hasta liquidarlo. |
| R12 | Un adelanto se puede borrar mientras no haya sido descontado en ningún pago. |

### Ejemplo de cuenta

Juan — Oficial — jornal **$45.000**. Semana sáb 26/9 → vie 2/10:
lun 1 · mar 1 · mié **2** (doble) · jue 1 · vie **1½** (medio día más) = **6½ jornales**.

| Concepto | Monto |
|---|---|
| Ganado: 6½ × $45.000 | $292.500 |
| Plus | + $5.000 |
| Adelanto del martes (se descuenta ahora) | − $30.000 |
| Cargo por amoladora rota (se deja para el próximo pago) | $0 |
| **A pagar** | **$267.500** |
| Queda pendiente para el próximo pago | $20.000 |

---

## 6. Modelo de datos (MySQL)

```
usuarios           id, username, password_hash
cuadrillas         id, nombre, obra, color, encargado_id → obreros, activa
obreros            id, nombre, rol, jornal, telefono, nota, cuadrilla_id → cuadrillas, activo
asistencias        id, obrero_id, fecha, jornales(0.5|1|1.5|2), nota, pago_id → pagos
                   UNIQUE(obrero_id, fecha)  — asistencia general: 1 registro por obrero por día
adelantos          id, obrero_id, tipo('adelanto'|'cargo'), monto, fecha, nota, movimiento_id
pagos              id, hasta (corte), fecha (día que se pagó), totales, nota
pago_items         id, pago_id, obrero_id, dias, jornales, jornal, bruto, plus, descuento, neto, desde
herramientas       id, nombre, tipo('herramienta'|'maquina'), cantidad (total), valor, nota, activo
herramienta_stock  herramienta_id, cuadrilla_id, cantidad      (pañol = total − Σ stock)
herramienta_movs   id, herramienta_id, tipo, cantidad, desde_id, hacia_id, responsable_id, cargo, nota, fecha
                   tipo: alta | ajuste | entrega | devolucion | traslado | robo | faltante | rotura
```

### 6.1 Cálculos derivados
- **Deuda** de un obrero = Σ adelantos (incluye cargos) − Σ descuentos aplicados en pagos.
- **Pendiente** = asistencias sin `pago_id`. *Le queda* = pendiente × jornal − deuda.
- Qué adelantos ya se descontaron se calcula por orden de antigüedad (el más viejo primero).

### 6.2 Fechas
Todas las fechas son del calendario local (Argentina). La app envía siempre `YYYY-MM-DD`
y la base las devuelve como texto, sin zonas horarias (evita el error de "día corrido" a la
noche que tenía el sistema anterior).

### 6.3 Migración desde el sistema anterior
Al iniciar, `initDB` detecta las tablas viejas (`proyectos`, `trabajadores`,
`asignaciones`, `asistencias` por obra, `ingresos_obra`, `gastos_proveedor`,
`comprobantes`) y las **renombra a `legacy_*`** sin borrar datos. Si había trabajadores
cargados, se copian a `obreros` con su último jornal. La asistencia vieja **no** se copia
(si no, aparecería como deuda a pagar).

---

## 7. API (resumen)

| Método | Ruta | Para qué |
|---|---|---|
| POST | `/api/auth/login` · `/api/auth/clave` | Ingresar · cambiar contraseña |
| GET | `/api/estado` | Todo lo base de una vez: obreros (con deuda y pendiente), cuadrillas, herramientas, stock |
| POST/PUT/DELETE | `/api/obreros[/:id]` | Alta, edición, baja |
| GET | `/api/obreros/:id/cuenta` | Días sin pagar, adelantos (con estado), pagos |
| POST/PUT/DELETE | `/api/cuadrillas[/:id]` | Alta, edición (encargado), cierre |
| PUT | `/api/cuadrillas/:id/integrantes` | Definir integrantes |
| GET/PUT | `/api/asistencia` | Rango de días · marcar un día (0 = falta) |
| POST | `/api/asistencia/lote` | "Todos ✓" |
| GET/POST/DELETE | `/api/adelantos` | Adelantos |
| GET | `/api/pagos/preview?hasta=` | Cálculo del próximo pago |
| GET/POST/DELETE | `/api/pagos[/:id]` | Historial · confirmar · anular |
| POST/PUT/DELETE | `/api/herramientas[/:id]` | Inventario |
| POST | `/api/herramientas/mover` | Entregar / devolver / trasladar (varias a la vez) |
| POST | `/api/herramientas/reclamo` | Robo, faltante, rotura (+ cargo opcional) |
| GET | `/api/herramientas/movimientos` | Historial |

---

## 8. Guía de interacción en el celular

**Gestos**
- Tocar el tilde → presente / falta. **Mantener apretado** → opciones de jornada.
- Tocar el nombre → ficha rápida (saldo + adelanto).
- **Deslizar** la lista de Asistencia a los costados → día anterior / siguiente.
- Arrastrar un panel hacia abajo o tocar *atrás* → se cierra.

**Botón flotante** ("Adelanto", "Nuevo"…): se esconde mientras bajás por la lista para no
tapar los tildes y vuelve al subir o al parar.

**Animaciones** (cortas, con resorte, nunca bloquean):
- Tilde: rebote + trazo que se dibuja; vibración corta en Android.
- "Todos ✓": cascada de tildes.
- Paneles que suben desde abajo; fondo que se oscurece.
- Cambio de sección: fundido con desplazamiento corto. Cambio de día: deslizamiento
  en la dirección del gesto.
- Totales que "cuentan" hasta el nuevo valor. Listas que se reacomodan suavemente.
- Avisos que bajan desde arriba con **Deshacer**.
- Si el teléfono tiene activado "reducir movimiento", se respetan.

**Velocidad**
- La app guarda una copia de los datos en el teléfono: abre al instante y después actualiza.
- Los cambios se ven en pantalla antes de que responda el servidor; si algo falla, vuelve
  atrás y avisa.
- Asistencia sin señal: queda en cola en el teléfono y se sube sola. Si la sesión vence,
  la cola se conserva y se sube al volver a entrar.
- Si la app queda abierta de un día para otro, al volver a mirarla ya muestra el día nuevo
  (y en Pagos, la semana nueva).
- Instalable como app (PWA): "Agregar a pantalla de inicio".

**Lectura al sol**: tema claro de alto contraste por defecto (oscuro automático si el
teléfono lo usa), números tabulares grandes, colores con significado fijo:
verde = presente, ámbar = adelantos/deuda, rojo = faltas/reclamos, azul = jornada distinta de 1.

---

## 9. Lo que pediste → dónde está

| Pedido | Funcionalidad |
|---|---|
| Asistencia general, no por obra, marcando con tilde | Asistencia: 1 tilde por obrero por día (F1) |
| Cargar obreros con su sueldo por día | Obreros: jornal individual (F9) |
| Roles oficial, capataz, ayudante | Rol: Capataz / Oficial / Medio oficial / Ayudante |
| Pagamos por día; el viernes la semana; si falta no se paga | Pagos sáb→vie, falta = $0 (R1–R3) |
| Cada uno tiene su sueldo y a veces pagamos un poco más | Jornal individual + **Plus** en el pago |
| Medio día más o doble jornada | Jornada ½ · 1 · 1½ · 2 (F2) |
| Anotar adelantos | Adelanto desde Asistencia, ficha o botón flotante (F3) |
| Cuánto le queda a cada uno al tomar asistencia y si tuvo adelanto | "lleva / adel. / le queda" en cada fila (F4) |
| Descontar el adelanto el día de pago o dejarlo para otro pago | Interruptor y monto parcial por obrero (F5, R4) |
| Saber cuánto es el total a pagar | Total a pagar + resumen al confirmar (F5) |
| Inventario de herramientas y máquinas | Herramientas (F8) |
| Repartir herramientas por obra / cuadrilla | Entregar, devolver, mover (F6) |
| Encargado que da la cara si se roban, faltan o rompen | Encargado por cuadrilla + reclamos a su nombre + cargo opcional (F7, R8) |
| Dividir obreros por cuadrilla (ej. Plaza Funes, 4 personas + encargado) | Cuadrillas (F10) |
| Muy funcional en el celular, rápido, simple, con animaciones | §8 |
