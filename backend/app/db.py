"""Conexión a PostgreSQL (asyncpg) y preparación de la base."""

import logging
from pathlib import Path

import asyncpg

from . import config
from .seguridad import hash_clave

log = logging.getLogger("etem")
ESQUEMA = (Path(__file__).parent / "esquema.sql").read_text(encoding="utf-8")
CANDADO_ESQUEMA = 4206


async def _iniciar_conexion(con: asyncpg.Connection) -> None:
    # NUMERIC → float (las cuentas son en pesos con, como mucho, centavos).
    await con.set_type_codec("numeric", encoder=str, decoder=float, schema="pg_catalog", format="text")


async def crear_pool(dsn: str | None = None) -> asyncpg.Pool:
    return await asyncpg.create_pool(
        dsn or config.DATABASE_URL, min_size=1, max_size=10, init=_iniciar_conexion, command_timeout=30
    )


async def preparar(pool: asyncpg.Pool) -> None:
    """Aplica el esquema (con candado por si arrancan varios procesos) y crea el admin si falta."""
    async with pool.acquire() as c:
        await c.execute("SELECT pg_advisory_lock($1)", CANDADO_ESQUEMA)
        try:
            await c.execute(ESQUEMA)
            await c.execute("DELETE FROM ops_aplicadas WHERE aplicada < now() - interval '120 days'")
            hay_usuarios = await c.fetchval("SELECT EXISTS (SELECT 1 FROM usuarios)")
            if not hay_usuarios:
                if config.ADMIN_CLAVE:
                    await c.execute(
                        "INSERT INTO usuarios (usuario, clave_hash) VALUES ('admin', $1)", hash_clave(config.ADMIN_CLAVE)
                    )
                    log.info("Usuario 'admin' creado.")
                else:
                    log.warning("No hay usuarios. Creá uno con: python -m scripts.usuario admin")
        finally:
            await c.execute("SELECT pg_advisory_unlock($1)", CANDADO_ESQUEMA)
