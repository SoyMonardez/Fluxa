"""Punto de entrada: uvicorn app.main:app"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException
from starlette.middleware.gzip import GZipMiddleware

from . import auth, config, db, estaticos, sync
from .respuesta import Rapida

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


@asynccontextmanager
async def vida(app: FastAPI):
    if len(config.SECRETO) < 16:
        raise RuntimeError("Falta SECRETO (16 caracteres o más) en el entorno o en backend/.env")
    app.state.pool = await db.crear_pool()
    await db.preparar(app.state.pool)
    yield
    await app.state.pool.close()


app = FastAPI(title="Fluxa / ETEM", lifespan=vida, docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.exception_handler(HTTPException)
async def error_http(request: Request, exc: HTTPException):
    detalle = "Ruta inexistente." if exc.status_code == 404 and exc.detail == "Not Found" else exc.detail
    return Rapida({"error": detalle}, status_code=exc.status_code, headers=getattr(exc, "headers", None))


@app.exception_handler(RequestValidationError)
async def error_validacion(request: Request, exc: RequestValidationError):
    return Rapida({"error": "Datos inválidos."}, status_code=400)


@app.get("/api/salud")
async def salud():
    return Rapida({"ok": True})


app.include_router(auth.router, prefix="/api/auth")
app.include_router(sync.router, prefix="/api")
estaticos.montar(app, config.DIST)  # al final: atrapa todo lo que no sea /api
