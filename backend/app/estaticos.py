"""Sirve la app compilada (frontend/dist) con caché bien puesta y vuelta a index.html."""

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

log = logging.getLogger("etem")

SIN_CACHE = {"index.html", "sw.js", "registerSW.js", "manifest.webmanifest"}


def _cache(archivo: Path, dist: Path) -> str:
    relativo = archivo.relative_to(dist).as_posix()
    if relativo.startswith("assets/"):
        return "public, max-age=31536000, immutable"  # llevan hash en el nombre
    if archivo.name in SIN_CACHE:
        return "no-cache"
    return "public, max-age=86400"


def montar(app: FastAPI, dist: Path) -> None:
    dist = dist.resolve()
    indice = dist / "index.html"
    if not indice.is_file():
        log.warning("No está la app compilada en %s: sólo se sirve la API.", dist)
        return

    @app.get("/{ruta:path}", include_in_schema=False)
    async def archivo(ruta: str):
        if ruta == "api" or ruta.startswith("api/"):
            raise HTTPException(404, "Ruta inexistente.")
        if ruta:
            destino = (dist / ruta).resolve()
            if destino.is_file() and destino.is_relative_to(dist):
                return FileResponse(destino, headers={"Cache-Control": _cache(destino, dist)})
        return FileResponse(indice, headers={"Cache-Control": "no-cache"})
