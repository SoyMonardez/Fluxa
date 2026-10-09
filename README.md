# Fluxa / ETEM — Obras desde el celular

App para reemplazar el cuaderno de obra: **asistencia** con un tilde, **pagos del viernes**
con descuento de **adelantos**, **cuadrillas** con su **encargado** y el **reparto de
herramientas** con sus reclamos. Pensada primero para el celular, **se instala como una
app** y **funciona sin internet**: todo se guarda en el teléfono y se sube solo cuando
vuelve la señal.

El diseño completo (patrones de uso, flujos, reglas de pago, sincronización y modelo de
datos) está en **[docs/DISENO.md](docs/DISENO.md)**.

![Asistencia, jornada, ficha y adelanto](docs/capturas/1-asistencia-y-adelantos.png)
![Semana y día de pago](docs/capturas/2-semana-y-pagos.png)
![Cuadrillas, encargados y herramientas](docs/capturas/3-cuadrillas-y-herramientas.png)
![Sin señal](docs/capturas/4-sin-senal.png)

---

## Qué hace

| Sección | Para qué |
|---|---|
| **Asistencia** | Lista general del día (no por obra), agrupada por cuadrilla. Un toque = presente; mantener apretado = ½, 1½ (medio día más) o doble. "Todos" por cuadrilla. En cada fila: adelantos y **cuánto le queda** cobrar. Deslizar para cambiar de día. Vista semanal. |
| **Pagos** | Semana de **sábado a viernes**, se paga el viernes. Total a pagar, días de cada uno, descontar adelantos **todo / una parte / después**, plus, excluir a alguien. Confirmar, compartir por WhatsApp, recibos, historial y anular. |
| **Cuadrillas** | Cada obra con sus integrantes y un **encargado** que responde por las herramientas. Entregar del pañol, devolver, mover entre obras, reclamos e historial. |
| **Herramientas** | Inventario de herramientas y máquinas, dónde está cada unidad y quién responde. Reclamo por **robo, faltante o rotura** con opción de **cobrárselo** al responsable. |
| **Obreros** | Nombre, rol (capataz, oficial, medio oficial, ayudante), **jornal por día**, cuadrilla y teléfono. Ficha con su cuenta, adelantos y pagos. |

## Sin señal y como app

- **Todo** funciona sin conexión: marcar, adelantos, pagar, cuadrillas, herramientas, altas.
  Los cambios quedan guardados en el teléfono (IndexedDB) aunque se cierre la app.
- Arriba aparece una nube tachada con la cantidad de cambios sin subir. Cuando vuelve la
  señal se suben solos, en orden y sin duplicarse, y se bajan los cambios de los otros
  celulares.
- Si algo no se pudo guardar (ej.: esa semana ya la pagó otro celular sin señal), avisa
  por qué y la pantalla queda como está en el servidor.
- La app se abre sin señal (service worker). Se instala desde el navegador: en Android
  aparece "Instalar"; en iPhone, Compartir → **Agregar a inicio**.

## Tecnología

- **Backend** (`/backend`): Python 3.11+ con **FastAPI**, **asyncpg** y **uvicorn**
  (uvloop + httptools). Un solo proceso sirve la API y la app.
- **Base de datos**: **PostgreSQL** 14 o más nuevo (probado con 16 y 17).
- **Frontend** (`/frontend`): **React 19**, Vite, Tailwind CSS 4, íconos Lucide. Animaciones
  hechas con CSS (sin librerías). PWA con Workbox. Primera pantalla: ~100 KB comprimidos.

```
backend/app/
  main.py            arranque, errores y archivos de la app
  auth.py            ingreso, sesión (120 días, se renueva sola) y cambio de contraseña
  sync.py            /api/sync: aplica las operaciones del celular y devuelve los cambios
  operaciones.py     las reglas de cada operación (asistencia, adelantos, pagos, herramientas…)
  esquema.sql        tablas (se crean/actualizan solas al arrancar)
backend/scripts/     usuario.py (crear usuarios / cambiar clave), ejemplo.py (datos de prueba)
frontend/src/
  motor/             datos en el teléfono: reglas (las mismas del servidor), cola,
                     IndexedDB, sincronización y cálculos de pago
  lib/               acciones, estado, fechas y formatos
  ui/                piezas: hojas deslizables, tilde, avisos, campos
  shell/             ingreso, barra de secciones, menú
  secciones/         asistencia, pagos, cuadrillas, herramientas, obreros
```

---

## Ponerla en marcha con Docker (recomendado)

### En esta PC (Windows)

1. Abrí Docker Desktop.
2. Hacé doble clic en **`INICIAR-FLUXA.cmd`**. La primera vez compila la app y genera
   claves al azar en `.env.local`. Conservá ese archivo: no se sube a GitHub.
3. Entrá a **http://localhost:8180** con usuario **admin** y la clave `ADMIN_CLAVE`
   de `.env.local`. Podés cambiarla desde el menú de la app.

La base real empieza vacía. Los datos persisten en el volumen `fluxa-local_datos`,
incluso al apagar la PC. `DETENER-FLUXA.cmd` detiene el sistema y conserva los datos.
La app usa el puerto 8180 y su PostgreSQL el 5547, ambos accesibles sólo desde esta PC.
No usa Apache ni MySQL de XAMPP.

**Respaldo:** `RESPALDAR-FLUXA.cmd` guarda una copia de la base en `respaldos/`.
Copiá esos archivos también a otro disco. Se restauran con `pg_restore` en una base
vacía; no borres el volumen de Docker para actualizar el sistema.

**Demostración opcional, separada de los datos reales:**

```powershell
docker compose --env-file .env.local -f compose.local.yml exec -T db createdb -U etem etem_demo
docker compose --env-file .env.local -f compose.local.yml --profile demo up -d demo
docker compose --env-file .env.local -f compose.local.yml exec -T demo python -m scripts.ejemplo
```

La demo se abre en http://localhost:8181 con el mismo usuario y clave inicial. Si ya
existe `etem_demo`, salteá el primer comando. No cargues datos reales en la demo.

### En un servidor, para usar desde el celular

Necesitás un servidor con Docker y un **dominio que apunte a él** (puede ser uno gratis,
por ejemplo de DuckDNS). El HTTPS es obligatorio para que el celular deje instalar la app y
usarla sin señal; **Caddy lo saca solo** (certificado de Let's Encrypt).

1. `cp .env.example .env` y completá `DOMINIO`, `DB_PASSWORD`, `SECRETO` y `ADMIN_CLAVE`.
2. `docker compose up -d --build`
3. Abrí `https://<tu dominio>` y entrá con **admin** y la contraseña de `ADMIN_CLAVE`.
4. En el celular: **Instalar** (Android) o Compartir → **Agregar a inicio** (iPhone).

Son tres contenedores: `db` (PostgreSQL), `app` (Python + la app compilada, ~130 MB) y
`web` (Caddy, HTTPS). En un servicio que ya da HTTPS (Railway, Render, Fly…) alcanza con el
`Dockerfile` y una base PostgreSQL: variables `DATABASE_URL`, `SECRETO` y `ADMIN_CLAVE`.

Tareas comunes:

```bash
# Otro usuario, o cambiar una contraseña olvidada
docker compose exec app python -m scripts.usuario juan
# Copia de seguridad de la base
docker compose exec -T db pg_dump -U etem etem > respaldo-$(date +%F).sql
```

## Desarrollo

Necesitás Python 3.11+, Node.js 22 y PostgreSQL.

```bash
# Base de datos
createdb etem

# Backend (http://localhost:8000)
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
cat > .env <<'EOF'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/etem
SECRETO=una-frase-larga-y-al-azar-para-desarrollo
ADMIN_CLAVE=una-clave
EOF
python -m scripts.ejemplo        # (opcional) datos de ejemplo
uvicorn app.main:app --reload

# Frontend (otra terminal, http://localhost:5173; le pasa /api al backend)
cd frontend
npm install
npm run dev
```

Con `npm run build`, el backend también sirve la app compilada en `http://localhost:8000`.

## Pruebas

```bash
# Backend: reglas y API contra PostgreSQL (el nombre debe terminar en _test; su esquema se borra)
cd backend && TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/etem_test pytest

# Frontend: reglas locales, cálculos y sincronización (sin señal, rechazos, reintentos…)
cd frontend && npm test && npm run lint && npm run build
```

En PowerShell, definí la variable de prueba antes de ejecutar `pytest`:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://usuario:clave@localhost:5547/etem_test'
cd backend
.\.venv\Scripts\python.exe -m pytest
```

GitHub Actions ejecuta las pruebas, lint y build del frontend en Windows y Linux,
y las pruebas de la API con PostgreSQL 17. Los casos incluyen reintentos, datos sin
señal, respuestas fuera de orden entre pestañas, fallos de almacenamiento y pagos
con un jornal desactualizado. El detalle de la revisión está en `docs/ENTREGA.md`.

---

## Si venías usando la versión anterior

La versión anterior usaba Node.js y MySQL; ésta usa Python y PostgreSQL y arranca con la
base vacía. Los obreros se cargan rápido desde **Obreros → Nuevo → Guardar y otro**.

## Licencia

El repositorio no incluye un archivo de licencia de distribución.
