# Gestión en el VPS

URL: **https://gestion.alejomonardez.com**.

La app usa `compose.vps.yml`, PostgreSQL 17 y el Nginx Proxy Manager existente
para HTTPS. Sus contenedores son `gestion-fluxa-app` y `gestion-fluxa-db`; la
base no publica ningún puerto. Los datos persisten en `gestion-fluxa_datos`.
La versión anterior de Fluxa permanece separada y conserva sus datos.

En el servidor, `/opt/gestion/.env` contiene las claves (permisos 600; no se
suben a GitHub). `FLUXA_VERSION` identifica el commit de la imagen instalada.
El archivo `/opt/gestion/DEPLOYED_COMMIT` registra la revisión completa, y
`/opt/gestion/releases/` conserva el código de cada entrega.

## Operación

```bash
cd /opt/gestion
docker compose --env-file .env -f compose.vps.yml ps
docker compose --env-file .env -f compose.vps.yml logs --tail=100 app
bash /opt/gestion/scripts/respaldar-vps.sh
```

Hay un respaldo diario de PostgreSQL en `/opt/gestion/backups/`, ejecutado desde
`/etc/cron.d/gestion-fluxa`. Conviene copiar esos respaldos también fuera del VPS.
No borrar el volumen al actualizar. Antes de reemplazar una imagen, ejecutar
el respaldo, cargar la nueva imagen `gestion-fluxa:<commit>`, actualizar
`FLUXA_VERSION` y ejecutar `docker compose --env-file .env -f compose.vps.yml
up -d --wait`.

El usuario inicial es `admin`. La contraseña se entrega por separado y se
puede cambiar desde el menú de la app. Para instalar en el celular: Chrome →
Instalar app (Android), o Safari → Compartir → Agregar a inicio (iPhone).
