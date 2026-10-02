"""Ingreso, sesión y cambio de contraseña."""

import asyncio
import time

from fastapi import APIRouter, Depends, HTTPException, Request

from . import config
from .modelos import CambioClave, Login
from .respuesta import Rapida
from .seguridad import hash_clave, huella, leer, nuevo_token, verificar_clave

router = APIRouter()

# Freno simple contra adivinar la clave: 8 intentos fallidos cada 15 minutos por IP.
_fallos: dict[str, tuple[int, float]] = {}
VENTANA, MAX_FALLOS = 15 * 60, 8
_HASH_FALSO = hash_clave("clave-falsa-para-igualar-tiempos")


def _bloqueado(ip: str) -> bool:
    n, hasta = _fallos.get(ip, (0, 0.0))
    return hasta > time.time() and n >= MAX_FALLOS


def _anotar_fallo(ip: str) -> None:
    n, hasta = _fallos.get(ip, (0, 0.0))
    _fallos[ip] = (1, time.time() + VENTANA) if hasta < time.time() else (n + 1, hasta)


def _ip(request: Request) -> str:
    return request.client.host if request.client else "?"


@router.post("/login")
async def ingresar(d: Login, request: Request):
    ip = _ip(request)
    if _bloqueado(ip):
        raise HTTPException(429, "Demasiados intentos. Probá de nuevo en unos minutos.")
    async with request.app.state.pool.acquire() as c:
        u = await c.fetchrow("SELECT id, usuario, clave_hash FROM usuarios WHERE usuario = $1", d.usuario)
    # Se verifica igual aunque el usuario no exista, para no delatar cuáles existen.
    ok = await asyncio.to_thread(verificar_clave, d.clave, u["clave_hash"] if u else _HASH_FALSO)
    if not u or not ok:
        _anotar_fallo(ip)
        raise HTTPException(401, "Usuario o contraseña incorrectos.")
    _fallos.pop(ip, None)
    return Rapida({"token": nuevo_token(u["id"], u["usuario"], u["clave_hash"], config.SECRETO), "usuario": u["usuario"]})


async def usuario_actual(request: Request) -> dict:
    cabecera = request.headers.get("authorization", "")
    datos = leer(cabecera[7:], config.SECRETO) if cabecera.startswith("Bearer ") else None
    if datos is None:
        raise HTTPException(401, "La sesión venció. Volvé a ingresar.")
    async with request.app.state.pool.acquire() as c:
        u = await c.fetchrow("SELECT id, usuario, clave_hash FROM usuarios WHERE id = $1", datos.get("uid"))
    if u is None or huella(u["clave_hash"]) != datos.get("h"):
        raise HTTPException(401, "La sesión venció. Volvé a ingresar.")
    return {**datos, "clave_hash": u["clave_hash"]}


@router.post("/clave")
async def cambiar_clave(d: CambioClave, request: Request, u: dict = Depends(usuario_actual)):
    if not await asyncio.to_thread(verificar_clave, d.actual, u["clave_hash"]):
        raise HTTPException(400, "La contraseña actual no es correcta.")
    nuevo_hash = await asyncio.to_thread(hash_clave, d.nueva)
    async with request.app.state.pool.acquire() as c:
        await c.execute("UPDATE usuarios SET clave_hash = $2 WHERE id = $1", u["uid"], nuevo_hash)
    # Las otras sesiones quedan cerradas; ésta sigue con un token nuevo.
    return Rapida({"ok": True, "token": nuevo_token(u["uid"], u["u"], nuevo_hash, config.SECRETO)})
