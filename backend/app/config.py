"""Configuración desde variables de entorno (y backend/.env si existe)."""

import os
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def _cargar_env(archivo: Path) -> None:
    """Lee un .env simple (CLAVE=valor). Las variables ya definidas tienen prioridad."""
    if not archivo.is_file():
        return
    for linea in archivo.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        clave, valor = linea.split("=", 1)
        os.environ.setdefault(clave.strip(), valor.strip().strip('"').strip("'"))


_cargar_env(RAIZ / ".env")

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/etem")
# Firma las sesiones. Tiene que ser larga y secreta.
SECRETO = os.environ.get("SECRETO", "")
# Si la base no tiene usuarios, se crea "admin" con esta clave.
ADMIN_CLAVE = os.environ.get("ADMIN_CLAVE", "")
ZONA_HORARIA = os.environ.get("ZONA_HORARIA", "America/Argentina/Buenos_Aires")
# Carpeta con la app compilada (frontend/dist). Si no existe, sólo se sirve la API.
DIST = Path(os.environ.get("FRONTEND_DIST", RAIZ.parent / "frontend" / "dist"))
