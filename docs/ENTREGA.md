# Continuación del trabajo de Claude — 9 de octubre de 2026

Base recuperada: `SoyMonardez/Fluxa`, rama `ccr-3d470e9f-2cnbh1`, commit `d55fcae`.
Trabajo local en la rama `codex/completar-asistencia-herramientas`.

## Funcionalidad

Se conserva la versión Python/PostgreSQL/React: obreros y jornales, asistencia
diaria y semanal, adelantos, pagos y anulaciones, cuadrillas con encargado,
inventario, entregas, traslados, devoluciones y reclamos de herramientas.

## Correcciones

- El comando de pruebas ahora encuentra los tests también en Windows.
- La sincronización confirma cambios sólo después de guardar la foto y el cursor.
  Ante un fallo de almacenamiento conserva la cola, avisa y permite reintentar.
- Una respuesta vieja de otra pestaña no reemplaza una foto más nueva en IndexedDB.
- Si el navegador sólo permite memoria temporal, la app lo informa; avisa al salir
  con cambios que todavía no se guardaron.
- Los pagos validan el jornal vigente, el corte y las cuentas hasta los centavos.
  El resumen permanece pendiente hasta confirmarse y reacciona si se rechaza o anula.
- Se conservan los identificadores de operaciones antiguas: un reintento meses
  después no vuelve a descontar herramientas ni a repetir una entrega.
- Las pruebas de API se niegan a borrar una base que no termine en `_test`.
- Se agregaron arranque y respaldo para Windows y una configuración Docker local
  independiente de los demás proyectos.

## Uso local

La app real está en http://localhost:8180. La demo opcional en http://localhost:8181
usa otra base. Las credenciales locales están en `.env.local`.
Usar los accesos `INICIAR-FLUXA.cmd`, `DETENER-FLUXA.cmd` y `RESPALDAR-FLUXA.cmd`.

Para usarla desde un celular fuera de esta PC falta desplegarla en un servidor con
dominio y HTTPS (configuración `docker-compose.yml`). No se realizó publicación
en internet ni migración de datos del sistema MySQL anterior.

## Verificación final

- 30 pruebas del frontend y 14 del backend aprobadas (PostgreSQL 17 real).
- Lint, compilación de producción y construcción Docker aprobados.
- Desde el navegador: alta de obrero y herramienta, entrega a cuadrilla y asistencia
  sin servidor; recarga offline y sincronización comprobada después en PostgreSQL.
- Pago ficticio: transición de pendiente a registrado y habilitación del recibo
  comprobadas en la pantalla. La demo usa datos separados de la aplicación real.
- Inicio mediante el script Windows y copia de seguridad comprobados.
- Respaldo restaurado en una base de prueba: 11 tablas recuperadas sin errores.
- La base real se entrega vacía, lista para cargar personal y herramientas.
