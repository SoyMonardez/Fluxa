#!/bin/sh
set -e

echo "Preparando base de datos..."
node scripts/initDB.js

echo "Arrancando API..."
exec node server.js
