#!/bin/sh
set -e

echo "Iniciando DB..."
node scripts/initDB.js

echo "Arrancando servidor..."
exec node server.js
