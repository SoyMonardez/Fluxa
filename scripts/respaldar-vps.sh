#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/gestion
exec 9>/opt/gestion/.respaldo.lock
flock -n 9 || exit 0
mkdir -p /opt/gestion/backups
archivo="/opt/gestion/backups/gestion-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose --env-file .env -f compose.vps.yml exec -T db \
  pg_dump -U etem -d etem --format=custom > "${archivo}.tmp"
test -s "${archivo}.tmp"
mv "${archivo}.tmp" "$archivo"
printf 'Respaldo: %s\n' "$archivo"
