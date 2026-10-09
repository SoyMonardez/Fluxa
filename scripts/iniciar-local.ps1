param([switch]$SinAbrir)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Instalá y abrí Docker Desktop antes de iniciar Fluxa.' }
docker info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Abrí Docker Desktop, esperá a que termine de iniciar y volvé a intentar.' }
$envPath = Join-Path (Get-Location) '.env.local'
if (-not (Test-Path -LiteralPath $envPath)) {
    $dbPass = [guid]::NewGuid().ToString('N')
    $sessionSecret = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
    $adminPass = 'Fluxa-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
    [IO.File]::WriteAllLines($envPath, @("DB_PASSWORD=$dbPass", "SECRETO=$sessionSecret", "ADMIN_CLAVE=$adminPass"))
    Write-Host "Usuario: admin / Contraseña inicial: $adminPass"
    Write-Host 'La clave queda guardada en .env.local (ADMIN_CLAVE).'
}
docker compose --env-file .env.local -f compose.local.yml up -d --build --wait --wait-timeout 120
if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar Fluxa. Revisá el mensaje de Docker de arriba.' }
Write-Host 'Fluxa listo en http://localhost:8180. Usuario: admin.'
if (-not $SinAbrir) { Start-Process 'http://localhost:8180' }
