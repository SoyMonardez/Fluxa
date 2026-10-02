# Fluxa / ETEM — Diseño del sistema

Este documento se escribió **antes** de programar, en el orden pedido: primero los
**patrones de uso**, después los **flujos**, y recién ahí las **funcionalidades**
(reglas, datos, arquitectura y pantallas). Todo lo que está acá está implementado.

**Stack:** React (celular primero, instalable) · Python (FastAPI) · PostgreSQL.
**Principio rector:** la app tiene que andar **igual con o sin internet**.

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

### Lo que se sacó (no se usaba)

- Obras con clientes e ingresos, **Proveedores**, **Comprobantes** (subida de archivos),
  **Dashboard** con gráficos, asistencia **por obra** y sueldo **por obra**.
- Todo el backend en Node/Express/MySQL y el servidor nginx: ahora es **un solo servicio en
  Python** que sirve la API y la app, más PostgreSQL.
- Librerías pesadas del frontend (router, axios, gráficos, toasts, animaciones): la app usa
  sólo **React** y animaciones **CSS** propias.

---

## 1. Quién la usa y en qué contexto

- **Usuario principal**: el dueño / administrador. Usa la app **casi siempre desde el
  celular**, parado, en la obra o en el auto, muchas veces con una sola mano y con sol.
- **Señal**: mala o nula en muchas obras → **todo** tiene que funcionar sin conexión.
- **Volumen**: de 10 a 60 obreros, varias cuadrillas, cientos de herramientas.

Principios de diseño:

1. **Lo frecuente, a un toque.** Pasar lista y dar un adelanto no pueden tener formularios.
2. **Una sección resuelve varias cosas.** Desde Asistencia se marca, se ajusta la jornada,
   se ve cuánto le queda a cada uno y se da un adelanto, sin cambiar de pantalla.
3. **Siempre a la vista "cuánto"**: lo que lleva ganado, lo que pidió y lo que le queda.
4. **Nada se pierde**: todo se puede deshacer o anular, y lo pagado queda bloqueado.
5. **Pulgar primero**: navegación abajo, botones grandes (≥ 44 px), paneles que suben
   desde abajo y se cierran arrastrando.
6. **Primero el teléfono, después el servidor**: cada cambio se guarda en el celular al
   instante y se sube solo cuando hay señal. Nunca hay que esperar a la red.
7. **Liviana**: abre en menos de un segundo, ocupa poco y se instala como una app.

---

## 2. Patrones de uso

| # | Patrón | Frecuencia | Contexto | Qué necesita | Meta |
|---|---|---|---|---|---|
| P1 | **Pasar lista** | Diario (mañana) | En obra o recibiendo mensajes de los encargados | Marcar a todos rápido y desmarcar a los que faltan | < 30 s para 20 obreros |
| P2 | **Ajustar jornada** | Varias por semana | Mismo momento que P1 o a la tarde | Poner ½, 1½ (medio día más) o doble | 2 toques |
| P3 | **Dar un adelanto** | Varias por semana, en cualquier momento | Le piden plata en la obra | Encontrar al obrero, ver si le alcanza, anotar el monto | < 10 s |
| P4 | **Consultar cuánto le queda** | Diario | "¿Cuánto me queda para el viernes?" | Ganado sin pagar − adelantos | 0 toques (visible en la lista) |
| P5 | **Día de pago** | Semanal (viernes) | Oficina, auto u obra, armando los sobres | Total a juntar, detalle por obrero, decidir descuento de adelantos, plus, confirmar y compartir | < 2 min |
| P6 | **Repartir herramientas** | Semanal / al arrancar obra | En el pañol o en la obra | Mandar varias herramientas a una cuadrilla, mover entre obras, devolver | 1 pantalla |
| P7 | **Reclamo** | Ocasional | Se robaron, falta o se rompió algo | Registrar a nombre del encargado y, si corresponde, cobrárselo | 1 panel |
| P8 | **¿Dónde está tal herramienta?** | Ocasional | Alguien pide una máquina | Buscar y ver en qué obra está y quién responde | Búsqueda |
| P9 | **Altas y cambios de personal** | Ocasional | Entra alguien nuevo / aumento | Cargar nombre + rol + jornal; cambiar jornal | 1 formulario |
| P10 | **Armar cuadrillas** | Al arrancar obra | Planificación | Nombre de la obra, integrantes, encargado | 1 pantalla |
| P11 | **Trabajar sin señal** | Cualquier día | Obra sin cobertura, subsuelo, ruta | Hacer **todo** lo anterior igual y que se suba solo después | Sin diferencias |
| P12 | **Tenerla como app** | Una vez | Primer uso en el celular | Instalarla en la pantalla de inicio y abrirla sin navegador | 2 toques |

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
| **Asistencia** | Ver el día o la semana · tilde por obrero · "Todos" por cuadrilla · jornada ½/1/1½/2 · ver *adelantos / le queda* · dar adelanto · buscar · cambiar de día deslizando |
| **Pagos** | Próximo pago (corte viernes) · total a pagar · detalle por obrero con los días · descontar adelantos todo / una parte / después · plus · excluir a alguien · confirmar · compartir por WhatsApp · historial · anular un pago |
| **Cuadrillas** | Crear cuadrilla (obra) · integrantes · elegir encargado · entregar herramientas del pañol · devolver / mover a otra obra · reclamo (robo, faltante, rotura) · historial · cerrar cuadrilla |
| **Herramientas** | Inventario de herramientas y máquinas · cantidades por lugar (pañol y obras) · enviar a una obra · sumar unidades · reclamo · movimientos |
| **Obreros** | Alta rápida (con "guardar y agregar otro") · editar jornal/rol/cuadrilla · ficha con cuenta (días sin pagar, adelantos, pagos) · adelanto · WhatsApp / llamar · dar de baja / reactivar |

En todas las secciones, arriba, un **indicador de sincronización**: nube tachada con el número
de cambios que esperan señal; al volver la conexión se suben solos.

Paneles (se abren desde abajo, se cierran arrastrando hacia abajo o con el botón *atrás*
del celular): ficha del obrero, jornada, adelanto, formularios, reparto de herramientas,
reclamo, confirmación de pago, menú.

---

## 4. Flujos

### F1 · Pasar lista (P1)
1. Abrís la app → **Asistencia** de hoy, obreros agrupados por cuadrilla.
2. En cada cuadrilla tocás **Todos** → se marcan todos con 1 jornal (animación en cascada).
3. Tocás el círculo de los que faltaron para desmarcarlos.
4. Arriba ves "**14 de 16 presentes · $ 630.000**".

*Toques: 1 por cuadrilla + 1 por falta.* Con o sin señal es igual.

### F2 · Medio día más / doble jornada (P2)
1. **Mantené apretado** el círculo.
2. Elegís **½ · 1 · 1½ · 2** (o **No vino**). Opcional: nota ("se quedó a hormigonar").
3. El círculo muestra la marca (½, 1½, 2) y el total del día se actualiza.

### F3 · Adelanto (P3)
- **Desde Asistencia**: tocás el nombre → ficha con *lleva $X · adelantos $Y · le queda $Z*
  → **Dar adelanto** → monto (teclado numérico + atajos que suman +5.000 / +10.000 /
  +20.000 / +50.000) → **Anotar**. Aviso "Adelanto de $X a Juan · **Deshacer**".
- **Botón flotante "Adelanto"** (en Asistencia): elegís obrero (con buscador) → monto → Anotar.
- Si el adelanto supera lo que le queda, la app lo avisa en ámbar (no lo impide).

### F4 · ¿Cuánto le queda? (P4)
Cada fila de Asistencia muestra **adelantos pendientes · le queda $**. En la ficha del obrero
está el detalle: días, adelantos (cuáles ya se descontaron) y pagos.

### F5 · Día de pago (P5)
1. **Pagos** muestra el corte "**Pago del viernes 2/10**" (semana sáb 26/9 → vie 2/10).
   Si quedaron días sin pagar de semanas anteriores, se suman solos y se marcan.
2. Arriba: **Total a pagar**, ganado, descuentos y plus, cantidad de jornales.
3. Cada obrero: días de la semana (S D L M M J V), jornales × jornal = ganado.
   Si tiene adelantos, tocás su fila y elegís **Descontar** (todo) · **Una parte** (monto) ·
   **Después** (pasa al próximo pago).
4. Opcional: **Plus** (ese "poquito más") con motivo; o **excluir** a alguien de este pago
   (sus días quedan para el próximo).
5. **Pagar $ X** → resumen (cuántos obreros, total, adelantos descontados y los que quedan
   pendientes) → **Confirmar pago**.
6. Listo: los días quedan **pagados y bloqueados**. **Compartir** manda el resumen por
   WhatsApp; desde el historial se manda el recibo a cada obrero o se **anula** el pago.

### F6 · Repartir herramientas (P6)
- **Cuadrillas → Plaza Funes → Entregar**: lista del pañol con buscador, tocás para sumar
  (+1) o usás − / + → **Entregar N herramientas**. Queda registrado a nombre del encargado.
- En cada herramienta de la cuadrilla: **Devolver al pañol**, **Mover a otra cuadrilla** o
  **Reclamo**.
- Desde **Herramientas** también: tocás una herramienta → **Enviar** a una cuadrilla.

### F7 · Reclamo: robo, faltante o rotura (P7)
1. En la herramienta (dentro de la cuadrilla o en Herramientas) → **Reclamo**.
2. Tipo: **Robo · Faltante · Rotura por mal uso**, cantidad, qué pasó.
3. Se muestra **quién responde** (el encargado de la cuadrilla).
4. Opcional: **Cobrárselo** (sugiere el valor de la herramienta × cantidad) a él u otro
   integrante → queda como **cargo** en su cuenta y se descuenta como un adelanto.
5. Esas unidades salen del inventario. Si aparece o se arregla: **Sumar unidades**.

### F8 · ¿Dónde está? (P8)
**Herramientas** → buscador → cada ítem muestra la barra de reparto
"3 en pañol · 2 Plaza Funes · 1 Roldán"; en el detalle, quién responde en cada obra.

### F9 · Alta de obrero (P9)
**Obreros → Nuevo** → nombre, rol (Capataz / Oficial / Medio oficial / Ayudante), jornal $/día
(sugiere el más común de ese rol), cuadrilla, teléfono → **Guardar** o **Guardar y otro**.

### F10 · Armar cuadrilla (P10)
**Cuadrillas → +** → nombre (ej. "Plaza Funes"), dirección, color → **Integrantes** (selección
múltiple; quien estaba en otra cuadrilla se mueve) → **Encargado** → **Entregar herramientas**.
Una cuadrilla sin encargado se marca en rojo: *"Falta encargado"*.

### F11 · Sin señal (P11)
1. Se usa la app normalmente: marcar, adelantos, pagar, mover herramientas, altas…
2. Cada cambio se guarda en el celular y arriba aparece la nube tachada con **N cambios**.
3. Al volver la señal (o al abrir la app con señal) se suben solos, en orden, y se bajan
   los cambios hechos desde otro dispositivo. Aviso: "Se subieron los N cambios hechos sin
   señal ✓".
4. Si algún cambio no se pudo aplicar (ej.: ese día ya se pagó desde otro celular), avisa
   qué fue ("No se guardó: …") y la pantalla vuelve a mostrar lo que quedó guardado.
5. La app abre aunque no haya señal, incluso cerrándola y volviéndola a abrir.
6. Si la sesión venció (ej.: se cambió la contraseña en otro celular), pide la clave encima
   de la app y avisa cuántos cambios hay guardados: no se pierde nada y se suben al entrar.
7. El menú muestra el estado: todo sincronizado / N sin subir / sin señal, la última
   sincronización y un botón **Sincronizar ahora**.

### F12 · Instalar (P12)
- **Android**: aparece la sugerencia "Instalá ETEM en el teléfono" (y el botón en el menú)
  → Instalar.
- **iPhone**: Compartir → **Agregar a inicio** (la app lo explica en la sugerencia y en el menú).
- Cuando hay una versión nueva aparece "Hay una versión nueva" con **Actualizar**: no se
  recarga sola en medio de algo.

---

## 5. Reglas de negocio

| # | Regla |
|---|---|
| R1 | **Semana de pago = sábado a viernes**, se paga el viernes. (Si se trabaja un sábado, se cobra el viernes siguiente.) |
| R2 | Día trabajado = **½, 1, 1½ o 2 jornales**. **Falta = no se paga**. |
| R3 | Ganado = jornales × **jornal del obrero** (cada uno tiene el suyo). Se toma el jornal vigente al pagar y queda guardado en el pago. |
| R4 | **Adelantos y cargos** forman la *deuda* del obrero. En cada pago se decide cuánto descontar: por defecto todo lo posible (sin pasar lo ganado); lo que no se descuenta **pasa al próximo pago**. |
| R5 | **A pagar = ganado + plus − descuento.** |
| R6 | Lo pagado queda **bloqueado**. Para corregir un día pagado se **anula el pago** (todo vuelve a estar pendiente, también la deuda). |
| R7 | Días sin pagar de semanas anteriores **se incluyen solos** en el próximo pago. Un día que se marca tarde (de una semana ya pagada) se paga el viernes siguiente. |
| R8 | Cada cuadrilla tiene **un encargado** (uno de sus integrantes) que responde por sus herramientas. Cada entrega y cada reclamo quedan registrados con el encargado de ese momento. |
| R9 | Inventario: **total = pañol + lo que tiene cada cuadrilla**. Un reclamo da de baja esas unidades. |
| R10 | **Cerrar una cuadrilla** devuelve todas sus herramientas al pañol y deja a sus integrantes sin cuadrilla. |
| R11 | Un obrero **dado de baja** no aparece en Asistencia; si le quedan días sin pagar, sigue apareciendo en Pagos hasta liquidarlo. |
| R12 | Un adelanto se puede borrar mientras no haya sido descontado en ningún pago. Los descuentos se aplican del adelanto más viejo al más nuevo. |

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

## 6. Arquitectura: primero el teléfono

```
 Celular (PWA instalada)                                   Servidor
┌──────────────────────────────────────────┐          ┌───────────────────────────┐
│ React (pantallas)                        │          │ FastAPI (Python)          │
│   ▲ lee "lo visible"                     │          │  /api/auth  /api/sync     │
│ Motor local                              │  HTTPS   │  aplica operaciones en    │
│   visible = base + operaciones pendientes│ ───────► │  orden, sin duplicar      │
│   base  ◄── cambios del servidor         │ ◄─────── │  devuelve cambios desde   │
│   cola  ──► operaciones sin subir        │          │  el último cursor         │
│ IndexedDB (todo guardado en el teléfono) │          ├───────────────────────────┤
│ Service worker (la app abre sin señal)   │          │ PostgreSQL                │
└──────────────────────────────────────────┘          └───────────────────────────┘
```

- **Todo cambio es una operación** (`{id, tipo, datos, ts}`) con un `id` único generado en
  el celular. Se aplica en el teléfono al instante (mismas reglas que el servidor), se guarda
  en la **cola** y se sube cuando hay señal.
- Los registros nuevos (obreros, cuadrillas, herramientas, adelantos, pagos) también llevan
  **ids generados en el celular** (UUID): así se pueden crear y usar sin señal.
- **Lo visible = base del servidor + operaciones pendientes.** Cuando el servidor responde,
  la base se actualiza, se sacan de la cola las operaciones confirmadas o rechazadas y se
  vuelven a aplicar las que siguen pendientes. Si el servidor rechazó algo, desaparece solo
  y se avisa el motivo.
- **Cálculos en el teléfono**: deuda, días sin pagar, *le queda*, el próximo pago completo,
  la cuenta de cada obrero y el stock por obra se calculan localmente. Por eso todo anda sin
  señal y responde al instante.
- **Servicio único**: el mismo proceso Python sirve la API y los archivos de la app
  (comprimidos y con caché larga). Delante va Caddy con HTTPS automático (sin HTTPS los
  celulares no permiten instalar la app ni usarla sin conexión).

### 6.1 Sincronización (`/api/sync`)

| Pieza | Cómo funciona |
|---|---|
| **Cursor** | Cada fila tiene `rev`, un número global que crece en cada alta o cambio (secuencia + trigger). El celular guarda el último `rev` que vio y pide "lo que cambió después de N". |
| **Primera vez** | `cursor = 0` → foto completa: datos maestros, adelantos y pagos, asistencia de los últimos 180 días más todo lo no pagado, últimos 400 movimientos. |
| **Subir** | `POST /api/sync {cursor, ops}` en tandas de hasta 100: el servidor toma un candado (escrituras de a una), aplica cada operación en orden dentro de su propio *savepoint*, la registra en `ops_aplicadas` y devuelve el resultado de cada una más los cambios desde el cursor. |
| **Sin duplicados** | Si se corta la señal justo después de subir, el celular reintenta: las operaciones ya aplicadas se reconocen por su `id` y no se repiten. |
| **Bajas** | No se borra nada: faltas = jornales 0, adelantos/pagos anulados, stock 0, obreros/cuadrillas/herramientas inactivos. Así las bajas también viajan como cambios. |
| **Cuándo** | Al hacer un cambio (medio segundo después), al volver la señal, al volver a la app y cada 45 s con la app abierta. Con reintentos crecientes si falla. |
| **Sesión** | Token firmado (120 días) que se renueva solo al sincronizar. Sin señal la sesión sigue abierta. Si vence, se pide la clave **sin borrar** lo guardado ni la cola. |

### 6.2 Operaciones

| Operación | Datos | Rechazos posibles |
|---|---|---|
| `obrero.guardar` | id, nombre, rol, jornal, teléfono, nota, cuadrilla | cuadrilla inexistente |
| `obrero.baja` / `obrero.alta` | id | obrero inexistente |
| `cuadrilla.guardar` | id, nombre, obra, color, encargado | encargado inexistente |
| `cuadrilla.integrantes` | id, obreros | cuadrilla cerrada |
| `cuadrilla.cerrar` | id, fecha | — (devuelve herramientas, libera integrantes) |
| `asistencia.marcar` | obrero, fecha, jornales (0 = falta), nota | día ya pagado |
| `asistencia.lote` | fecha, [obrero, jornales] | (los días pagados se saltean) |
| `adelanto.crear` | id, obrero, monto, fecha, nota | monto ≤ 0 |
| `adelanto.borrar` | id | ya descontado en un pago |
| `pago.crear` | id, corte, fecha, ítems (obrero, fechas, jornales, jornal, bruto, plus, descuento, neto) | días ya pagados o distintos, descuento mayor a la deuda, cuentas que no cierran |
| `pago.anular` | id | — |
| `herramienta.crear` | id, nombre, tipo, cantidad, valor, nota, cuadrilla destino | — |
| `herramienta.editar` | id, nombre, tipo, valor, nota | — |
| `herramienta.cantidad` | id, ±cantidad, motivo | quedaría menos que lo que está en obra |
| `herramienta.borrar` | id | tiene unidades en obra |
| `herramienta.mover` | desde, hacia, [herramienta, cantidad], nota | no alcanza en el origen |
| `herramienta.reclamo` | herramienta, cuadrilla, tipo, cantidad, nota, cargo opcional | no alcanza |

---

## 7. Modelo de datos (PostgreSQL)

```
usuarios           id, usuario, clave_hash (scrypt)
cuadrillas         id uuid, nombre, obra, color, encargado_id → obreros, activa, rev
obreros            id uuid, nombre, rol, jornal, telefono, nota, cuadrilla_id → cuadrillas, activo, rev
asistencias        (obrero_id, fecha) PK, jornales (0 = falta), nota, pago_id → pagos, rev
adelantos          id uuid, obrero_id, tipo (adelanto|cargo), monto, fecha, nota, movimiento_id, anulado, creado, rev
pagos              id uuid, hasta (corte), fecha, totales, nota, anulado, rev
pago_items         id uuid, pago_id, obrero_id, fechas date[], dias, jornales, jornal, bruto, plus, descuento, neto, nota, rev
herramientas       id uuid, nombre, tipo (herramienta|maquina), cantidad (total), valor, nota, activo, rev
herramienta_stock  (herramienta_id, cuadrilla_id) PK, cantidad          (pañol = total − Σ stock)
movimientos        id uuid, herramienta_id, tipo, cantidad, desde_id, hacia_id, responsable_id, cargo, nota, fecha, rev
ops_aplicadas      id uuid, tipo, ok, error, usuario_id, aplicada        (para no repetir operaciones)
```

- **Deuda** de un obrero = Σ adelantos no anulados − Σ descuentos de pagos no anulados.
- **Pendiente** = asistencias con jornales > 0 y sin pago. *Le queda* = pendiente × jornal − deuda.
- Fechas de calendario como `date` (sin zona horaria): el celular manda siempre `YYYY-MM-DD`.

---

## 8. Guía de interacción en el celular

**Gestos**
- Tocar el círculo → presente / falta. **Mantener apretado** → opciones de jornada.
- Tocar el nombre → ficha (saldo + adelanto).
- **Deslizar** la lista de Asistencia a los costados → día anterior / siguiente.
- Arrastrar un panel hacia abajo o tocar *atrás* → se cierra.

**Botón flotante** ("Adelanto", "Nuevo"…): se esconde mientras bajás por la lista para no
tapar los círculos y vuelve al subir o al parar.

**Animaciones** — hechas con CSS (sin librerías), con curvas tipo resorte:
- Círculo: rebote + trazo del tilde que se dibuja; vibración corta en Android.
- "Todos": cascada de tildes.
- Paneles que suben desde abajo; fondo que se oscurece; se cierran arrastrando.
- Cambio de sección: fundido corto. Cambio de día: deslizamiento según el gesto.
- Totales que "cuentan" hasta el nuevo valor. Píldoras que se deslizan en las pestañas.
- Avisos que bajan desde arriba con **Deshacer**.
- Si el teléfono tiene activado "reducir movimiento", se apagan.

**Velocidad y peso**
- Todo se lee del teléfono: no hay esperas ni cargas al tocar.
- Frontend: sólo React + íconos; animaciones en CSS. Backend: un proceso Python.
- Primera pantalla: ~100 KB comprimidos de JavaScript (React incluido). Lo que no se usa al
  pasar lista (pagos, cuadrillas, herramientas, formularios) va aparte y se precarga apenas
  aparece la primera pantalla, así nunca hay que esperar.
- Respuestas comprimidas, archivos con caché larga, y la app guardada por el service worker.
- La foto inicial de una empresa típica pesa ~6 KB comprimida; después sólo viajan cambios.

**Lectura al sol**: tema claro de alto contraste (oscuro automático si el teléfono lo usa),
números tabulares grandes, colores con significado fijo: verde = presente, ámbar =
adelantos/deuda, rojo = faltas/reclamos, azul = jornada distinta de 1.

---

## 9. Lo pedido → dónde está

| Pedido | Funcionalidad |
|---|---|
| Asistencia general, no por obra, marcando con tilde | Asistencia: 1 tilde por obrero por día (F1) |
| Cargar obreros con su sueldo por día | Obreros: jornal individual (F9) |
| Roles oficial, capataz, ayudante | Rol: Capataz / Oficial / Medio oficial / Ayudante |
| Pagamos por día; el viernes la semana; si falta no se paga | Pagos sáb→vie, falta = $0 (R1–R3) |
| Cada uno tiene su sueldo y a veces pagamos un poco más | Jornal individual + **Plus** en el pago |
| Medio día más o doble jornada | Jornada ½ · 1 · 1½ · 2 (F2) |
| Anotar adelantos | Adelanto desde Asistencia, ficha o botón flotante (F3) |
| Cuánto le queda a cada uno al tomar asistencia y si tuvo adelanto | "adel. / le queda" en cada fila (F4) |
| Descontar el adelanto el día de pago o dejarlo para otro pago | Todo / una parte / después, por obrero (F5, R4) |
| Saber cuánto es el total a pagar | Total a pagar + resumen al confirmar (F5) |
| Inventario de herramientas y máquinas | Herramientas (F8) |
| Repartir herramientas por obra / cuadrilla | Entregar, devolver, mover (F6) |
| Encargado que da la cara si se roban, faltan o rompen | Encargado por cuadrilla + reclamos a su nombre + cargo opcional (F7, R8) |
| Dividir obreros por cuadrilla (ej. Plaza Funes, 4 personas + encargado) | Cuadrillas (F10) |
| Muy funcional en el celular, rápido, simple, con animaciones | §8 |
| Python, PostgreSQL y React | FastAPI + asyncpg + PostgreSQL; React (§6, §7) |
| Lo más rápido y liviano posible | Datos locales, sin librerías pesadas, un solo servicio (§6, §8) |
| App descargable | PWA instalable (F12) |
| Usarla sin internet | Todo funciona sin señal y se sincroniza solo (F11, §6.1) |
