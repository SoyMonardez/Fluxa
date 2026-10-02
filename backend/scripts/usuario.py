"""Crea un usuario o le cambia la contraseña.

    python -m scripts.usuario admin            (pide la clave)
    python -m scripts.usuario admin --clave X
"""

import argparse
import asyncio
import getpass

from app import db
from app.seguridad import hash_clave


async def guardar(usuario: str, clave: str) -> None:
    pool = await db.crear_pool()
    try:
        await db.preparar(pool)
        async with pool.acquire() as c:
            await c.execute(
                """INSERT INTO usuarios (usuario, clave_hash) VALUES ($1, $2)
                   ON CONFLICT (usuario) DO UPDATE SET clave_hash = EXCLUDED.clave_hash""",
                usuario,
                hash_clave(clave),
            )
    finally:
        await pool.close()


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("usuario")
    p.add_argument("--clave")
    a = p.parse_args()
    clave = a.clave or getpass.getpass("Clave nueva (6 o más caracteres): ")
    if len(clave) < 6:
        raise SystemExit("La clave tiene que tener al menos 6 caracteres.")
    asyncio.run(guardar(a.usuario.strip(), clave))
    print(f"Listo: {a.usuario} ya puede entrar con esa clave.")


if __name__ == "__main__":
    main()
