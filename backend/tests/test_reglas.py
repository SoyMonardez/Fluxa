"""Reglas puras (sin base de datos)."""

import time
import uuid
from datetime import date

from app.calculos import estado_adelantos, semana_de_pago
from app.seguridad import firmar, hash_clave, hay_que_renovar, huella, leer, nuevo_token, verificar_clave


def test_semana_de_pago_va_de_sabado_a_viernes():
    assert semana_de_pago(date(2026, 10, 2)) == (date(2026, 9, 26), date(2026, 10, 2))  # viernes
    assert semana_de_pago(date(2026, 9, 28)) == (date(2026, 9, 26), date(2026, 10, 2))  # lunes
    assert semana_de_pago(date(2026, 10, 3)) == (date(2026, 10, 3), date(2026, 10, 9))  # sábado: semana nueva
    assert semana_de_pago(date(2026, 10, 4))[1] == date(2026, 10, 9)


def test_descuentos_del_adelanto_mas_viejo_al_mas_nuevo():
    a, b, c = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    adelantos = [
        {"id": c, "monto": 15000, "creado": 3},
        {"id": a, "monto": 10000, "creado": 1},
        {"id": b, "monto": 20000, "creado": 2},
    ]
    e = estado_adelantos(adelantos, 25000)
    assert e[a] == (10000, 0)
    assert e[b] == (15000, 5000)
    assert e[c] == (0, 15000)


def test_clave_scrypt():
    h = hash_clave("secreta123")
    assert h.startswith("scrypt$")
    assert verificar_clave("secreta123", h)
    assert not verificar_clave("otra", h)
    assert not verificar_clave("secreta123", "basura")


def test_token_firmado():
    t = firmar({"uid": 1, "exp": time.time() + 60}, "s" * 20)
    assert leer(t, "s" * 20)["uid"] == 1
    assert leer(t, "x" * 20) is None  # otra firma
    cuerpo, firma = t.split(".")
    assert leer(cuerpo + "A." + firma, "s" * 20) is None  # adulterado
    assert leer(firmar({"uid": 1, "exp": time.time() - 1}, "s" * 20), "s" * 20) is None  # vencido


def test_token_trae_huella_de_la_clave():
    h = hash_clave("abc12345")
    datos = leer(nuevo_token(7, "admin", h, "s" * 20), "s" * 20)
    assert datos["h"] == huella(h)
    assert not hay_que_renovar(datos)
    assert hay_que_renovar({**datos, "iat": datos["iat"] - 8 * 24 * 3600})
