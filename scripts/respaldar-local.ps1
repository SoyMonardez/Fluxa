$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$destino = Join-Path (Get-Location) 'respaldos'
New-Item -ItemType Directory -Path $destino -Force | Out-Null
$nombre = 'fluxa-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump'
$compose = @('compose', '--env-file', '.env.local', '-f', 'compose.local.yml')
& docker @compose exec -T db pg_dump -U etem -d etem -Fc -f "/tmp/$nombre"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el respaldo.' }
& docker @compose cp "db:/tmp/$nombre" (Join-Path $destino $nombre)
if ($LASTEXITCODE -ne 0) { throw 'No se pudo copiar el respaldo a esta PC.' }
& docker @compose exec -T db rm "/tmp/$nombre"
Write-Host "Respaldo guardado en: $(Join-Path $destino $nombre)"
