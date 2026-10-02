"""Claves (scrypt) y sesiones (token firmado con HMAC). Sólo biblioteca estándar + orjson."""

import base64
import hashlib
import hmac
import os
import time

import orjson

N, R, P = 2**14, 8, 1
DURACION = 120 * 24 * 3600  # la sesión dura 120 días…
RENOVAR = 7 * 24 * 3600  # …y se renueva sola al sincronizar si tiene más de una semana


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _deb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def hash_clave(clave: str) -> str:
    sal = os.urandom(16)
    h = hashlib.scrypt(clave.encode(), salt=sal, n=N, r=R, p=P, dklen=32)
    return f"scrypt${N}${R}${P}${_b64(sal)}${_b64(h)}"


def verificar_clave(clave: str, guardado: str) -> bool:
    try:
        algoritmo, n, r, p, sal, h = guardado.split("$")
        if algoritmo != "scrypt":
            return False
        esperado = _deb64(h)
        calculado = hashlib.scrypt(clave.encode(), salt=_deb64(sal), n=int(n), r=int(r), p=int(p), dklen=len(esperado))
        return hmac.compare_digest(calculado, esperado)
    except (ValueError, TypeError):
        return False


def huella(clave_hash: str) -> str:
    """Cambia cuando cambia la clave: invalida las sesiones viejas."""
    return hashlib.sha256(clave_hash.encode()).hexdigest()[:10]


def _firma(cuerpo: str, secreto: str) -> str:
    return _b64(hmac.new(secreto.encode(), cuerpo.encode(), hashlib.sha256).digest())


def firmar(datos: dict, secreto: str) -> str:
    cuerpo = _b64(orjson.dumps(datos))
    return f"{cuerpo}.{_firma(cuerpo, secreto)}"


def leer(token: str, secreto: str) -> dict | None:
    try:
        cuerpo, firma = token.split(".")
        if not hmac.compare_digest(firma, _firma(cuerpo, secreto)):
            return None
        datos = orjson.loads(_deb64(cuerpo))
    except (ValueError, orjson.JSONDecodeError):
        return None
    if not isinstance(datos, dict) or datos.get("exp", 0) < time.time():
        return None
    return datos


def nuevo_token(usuario_id: int, usuario: str, clave_hash: str, secreto: str) -> str:
    ahora = int(time.time())
    return firmar({"uid": usuario_id, "u": usuario, "h": huella(clave_hash), "iat": ahora, "exp": ahora + DURACION}, secreto)


def hay_que_renovar(datos: dict) -> bool:
    return time.time() - datos.get("iat", 0) > RENOVAR
