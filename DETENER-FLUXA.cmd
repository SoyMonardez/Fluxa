@echo off
cd /d "%~dp0"
docker compose --env-file .env.local -f compose.local.yml stop
if errorlevel 1 pause
