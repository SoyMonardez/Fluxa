"""Sincronización: el celular sube sus operaciones y baja lo que cambió.

GET  /api/sync?cursor=N        → cambios desde N (N = 0: foto completa)
POST /api/sync {cursor, ops}   → aplica las operaciones en orden y devuelve resultados + cambios
"""

import logging
from datetime import timedelta

import asyncpg
from fastapi import APIRouter, Depends, Request
from pydantic import ValidationError

from . import config
from .auth import usuario_actual
from .calculos import hoy
from .modelos import Op, Sincronizar
from .operaciones import OPERACIONES, Contexto, Rechazo
from .respuesta import Rapida
from .seguridad import hay_que_renovar, nuevo_token

log = logging.getLogger("etem")
router = APIRouter()

CANDADO_SYNC = 4207  # las escrituras van de a una: así el cursor nunca saltea cambios
VENTANA_DIAS = 180  # asistencia que viaja en la foto inicial (más todo lo no pagado)
MAX_MOVIMIENTOS = 400

# nombre en la respuesta → (tabla, consulta)
TABLAS = {
    "cuadrillas": ("cuadrillas", "SELECT id, nombre, obra, color, encargado_id, activa, rev FROM cuadrillas"),
    "obreros": ("obreros", "SELECT id, nombre, rol, jornal, telefono, nota, cuadrilla_id, activo, rev FROM obreros"),
    "asistencias": ("asistencias", "SELECT obrero_id, fecha, jornales, nota, pago_id, rev FROM asistencias"),
    "adelantos": (
        "adelantos",
        "SELECT id, obrero_id, tipo, monto, fecha, nota, movimiento_id, anulado,"
        " (extract(epoch FROM creado) * 1000)::bigint AS creado, rev FROM adelantos",
    ),
    "pagos": (
        "pagos",
        "SELECT id, hasta, fecha, total_bruto, total_plus, total_descuentos, total_neto, nota, anulado,"
        " (extract(epoch FROM creado) * 1000)::bigint AS creado, rev FROM pagos",
    ),
    "pago_items": (
        "pago_items",
        "SELECT id, pago_id, obrero_id, fechas, dias, jornales, jornal, bruto, plus, descuento, neto, nota, rev FROM pago_items",
    ),
    "herramientas": ("herramientas", "SELECT id, nombre, tipo, cantidad, valor, nota, activo, rev FROM herramientas"),
    "stock": ("herramienta_stock", "SELECT herramienta_id, cuadrilla_id, cantidad, rev FROM herramienta_stock"),
    "movimientos": (
        "movimientos",
        "SELECT id, herramienta_id, tipo, cantidad, desde_id, hacia_id, responsable_id, cargo, nota, fecha,"
        " (extract(epoch FROM creado) * 1000)::bigint AS creado, rev FROM movimientos",
    ),
}

_MAX_REV = "SELECT GREATEST(" + ", ".join(f"(SELECT COALESCE(max(rev), 0) FROM {t})" for t, _ in TABLAS.values()) + ")"


async def leer_cambios(c: asyncpg.Connection, cursor: int) -> dict:
    cambios: dict[str, list[dict]] = {}
    if cursor <= 0:
        desde = hoy() - timedelta(days=VENTANA_DIAS)
        for nombre, (_, sql) in TABLAS.items():
            if nombre == "asistencias":
                filas = await c.fetch(sql + " WHERE fecha >= $1 OR (jornales > 0 AND pago_id IS NULL)", desde)
            elif nombre == "movimientos":
                filas = await c.fetch(sql + " ORDER BY rev DESC LIMIT $1", MAX_MOVIMIENTOS)
            else:
                filas = await c.fetch(sql)
            cambios[nombre] = [dict(f) for f in filas]
        return {"cursor": await c.fetchval(_MAX_REV), "completo": True, "cambios": cambios}

    nuevo = cursor
    for nombre, (_, sql) in TABLAS.items():
        filas = await c.fetch(sql + " WHERE rev > $1", cursor)
        cambios[nombre] = [dict(f) for f in filas]
        if filas:
            nuevo = max(nuevo, max(f["rev"] for f in filas))
    return {"cursor": nuevo, "completo": False, "cambios": cambios}


def _mensaje(e: ValidationError) -> str:
    err = e.errors()[0]
    campo = ".".join(str(x) for x in err.get("loc", ())) or "datos"
    return f"Dato inválido ({campo})."


async def aplicar(c: asyncpg.Connection, bruta: object, usuario_id: int) -> dict:
    try:
        op = Op.model_validate(bruta)
    except ValidationError:
        ident = bruta.get("id") if isinstance(bruta, dict) else None
        return {"id": str(ident or ""), "ok": False, "error": "Operación inválida."}

    previa = await c.fetchrow("SELECT ok, error FROM ops_aplicadas WHERE id = $1", op.id)
    if previa is not None:  # reintento: ya se aplicó (o se rechazó) antes
        return {"id": str(op.id), "ok": previa["ok"], "error": previa["error"]}

    ok, error = True, None
    tipo = OPERACIONES.get(op.tipo)
    if tipo is None:
        ok, error = False, "Operación desconocida: actualizá la app."
    else:
        try:
            datos = tipo.modelo.model_validate(op.datos)
            async with c.transaction():  # savepoint: si falla, sólo se deshace esta operación
                await tipo.aplicar(c, datos, Contexto(op, usuario_id))
        except ValidationError as e:
            ok, error = False, _mensaje(e)
        except Rechazo as e:
            ok, error = False, str(e)
        except asyncpg.PostgresError:
            log.exception("Operación %s (%s) falló en la base", op.id, op.tipo)
            ok, error = False, "No se pudo guardar: los datos no son consistentes."

    await c.execute(
        "INSERT INTO ops_aplicadas (id, tipo, ok, error, usuario_id) VALUES ($1, $2, $3, $4, $5)",
        op.id, op.tipo[:40], ok, error, usuario_id,
    )
    return {"id": str(op.id), "ok": ok, "error": error}


def _respuesta(cambios: dict, u: dict, resultados: list | None = None) -> Rapida:
    cuerpo = {**cambios, "hoy": hoy().isoformat()}
    if resultados is not None:
        cuerpo["resultados"] = resultados
    if hay_que_renovar(u):
        cuerpo["token"] = nuevo_token(u["uid"], u["u"], u["clave_hash"], config.SECRETO)
    return Rapida(cuerpo)


@router.get("/sync")
async def bajar(request: Request, cursor: int = 0, u: dict = Depends(usuario_actual)):
    async with request.app.state.pool.acquire() as c:
        async with c.transaction(isolation="repeatable_read", readonly=True):
            cambios = await leer_cambios(c, max(cursor, 0))
    return _respuesta(cambios, u)


@router.post("/sync")
async def sincronizar(d: Sincronizar, request: Request, u: dict = Depends(usuario_actual)):
    resultados = []
    async with request.app.state.pool.acquire() as c:
        async with c.transaction():
            await c.execute("SELECT pg_advisory_xact_lock($1)", CANDADO_SYNC)
            for bruta in d.ops:
                resultados.append(await aplicar(c, bruta, u["uid"]))
            cambios = await leer_cambios(c, d.cursor)
    return _respuesta(cambios, u, resultados)
