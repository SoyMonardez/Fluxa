import asyncio
import os
import time
import uuid

import pytest

# Antes de importar la app: configuración de prueba.
TEST_DB = os.environ.get("TEST_DATABASE_URL")
os.environ["SECRETO"] = "secreto-de-prueba-0123456789"
os.environ["ADMIN_CLAVE"] = "clave-prueba"
os.environ["FRONTEND_DIST"] = "/no-existe"
if TEST_DB:
    os.environ["DATABASE_URL"] = TEST_DB


def nuevo_id() -> str:
    return str(uuid.uuid4())


_ultimo_ts = 0


def op(clase: str, /, **datos) -> dict:
    # Como en el celular, cada operación es posterior a la anterior (el orden de
    # los adelantos para descontarlos sale de este momento).
    global _ultimo_ts
    _ultimo_ts = max(int(time.time() * 1000), _ultimo_ts + 1)
    return {"id": nuevo_id(), "tipo": clase, "ts": _ultimo_ts, "datos": datos}


class Celular:
    """Imita al motor del celular: guarda el token y el cursor."""

    def __init__(self, http):
        self.http = http
        self.token = None
        self.cursor = 0

    def ingresar(self, usuario="admin", clave="clave-prueba"):
        r = self.http.post("/api/auth/login", json={"usuario": usuario, "clave": clave})
        assert r.status_code == 200, r.text
        self.token = r.json()["token"]
        return r.json()

    @property
    def cabeceras(self):
        return {"Authorization": f"Bearer {self.token}"}

    def bajar(self, cursor=None):
        r = self.http.get("/api/sync", params={"cursor": self.cursor if cursor is None else cursor}, headers=self.cabeceras)
        assert r.status_code == 200, r.text
        cuerpo = r.json()
        self.cursor = cuerpo["cursor"]
        return cuerpo

    def subir(self, *ops):
        r = self.http.post("/api/sync", json={"cursor": self.cursor, "ops": list(ops)}, headers=self.cabeceras)
        assert r.status_code == 200, r.text
        cuerpo = r.json()
        self.cursor = cuerpo["cursor"]
        return cuerpo


@pytest.fixture(scope="session")
def http():
    if not TEST_DB:
        pytest.skip("Definí TEST_DATABASE_URL (una base vacía de PostgreSQL) para las pruebas de la API.")
    import asyncpg

    async def limpiar():
        c = await asyncpg.connect(TEST_DB)
        await c.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        await c.close()

    asyncio.run(limpiar())
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as cliente:
        yield cliente


@pytest.fixture
def cel(http):
    c = Celular(http)
    c.ingresar()
    c.bajar(0)
    return c
