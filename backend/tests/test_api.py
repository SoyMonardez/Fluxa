"""Pruebas de la API contra PostgreSQL (TEST_DATABASE_URL)."""

from datetime import date, timedelta

from .conftest import Celular, nuevo_id, op

LUNES = date(2026, 9, 28)
DIAS = [LUNES + timedelta(days=i) for i in range(5)]  # lunes a viernes 2/10


def por_id(filas, ident, clave="id"):
    return next((f for f in filas if f[clave] == ident), None)


def armar_equipo(cel: Celular):
    """Cuadrilla con encargado y dos obreros más. Devuelve ids."""
    cu, juan, carlos, walter = nuevo_id(), nuevo_id(), nuevo_id(), nuevo_id()
    r = cel.subir(
        op("cuadrilla.guardar", id=cu, nombre="Plaza Funes", obra="Funes", color="naranja"),
        op("obrero.guardar", id=juan, nombre="Juan Pérez", rol="Oficial", jornal=45000, cuadrilla_id=cu),
        op("obrero.guardar", id=carlos, nombre="Carlos Gómez", rol="Medio oficial", jornal=38000, cuadrilla_id=cu),
        op("obrero.guardar", id=walter, nombre="Walter Ruiz", rol="Ayudante", jornal=30000),
        op("cuadrilla.guardar", id=cu, nombre="Plaza Funes", obra="Funes", color="naranja", encargado_id=juan),
    )
    assert all(x["ok"] for x in r["resultados"]), r["resultados"]
    return cu, juan, carlos, walter


def test_salud_y_login(http):
    assert http.get("/api/salud").json() == {"ok": True}
    assert http.post("/api/auth/login", json={"usuario": "admin", "clave": "mal"}).status_code == 401
    assert http.post("/api/auth/login", json={"usuario": "", "clave": "x"}).status_code == 400
    assert http.get("/api/sync").status_code == 401
    assert http.get("/api/sync", headers={"Authorization": "Bearer basura"}).status_code == 401
    assert http.get("/api/no-existe").json()["error"]


def test_foto_inicial_y_cambios_incrementales(cel):
    cu, juan, carlos, walter = armar_equipo(cel)
    foto = cel.bajar(0)
    assert foto["completo"] is True
    assert set(foto["cambios"]) == {
        "cuadrillas", "obreros", "asistencias", "adelantos", "pagos", "pago_items", "herramientas", "stock", "movimientos",
    }
    assert por_id(foto["cambios"]["cuadrillas"], cu)["encargado_id"] == juan
    cursor = foto["cursor"]
    assert cursor > 0
    cel.subir(op("obrero.guardar", id=walter, nombre="Walter Ruiz", rol="Ayudante", jornal=32000))
    cambios = cel.bajar(cursor)
    assert cambios["completo"] is False
    assert [o["id"] for o in cambios["cambios"]["obreros"]] == [walter]
    assert cambios["cambios"]["obreros"][0]["jornal"] == 32000
    # Sin cambios nuevos → nada
    assert all(not v for v in cel.bajar()["cambios"].values())


def test_asistencia_adelanto_pago_y_anulacion(cel):
    cu, juan, carlos, walter = armar_equipo(cel)
    r = cel.subir(
        op("asistencia.lote", fecha=str(DIAS[0]), items=[{"obrero_id": juan, "jornales": 1}, {"obrero_id": carlos, "jornales": 1}]),
        op("asistencia.marcar", obrero_id=juan, fecha=str(DIAS[1]), jornales=2, nota="doble"),
        op("asistencia.marcar", obrero_id=juan, fecha=str(DIAS[2]), jornales=1.5),
        op("asistencia.marcar", obrero_id=carlos, fecha=str(DIAS[1]), jornales=1),
        op("asistencia.marcar", obrero_id=carlos, fecha=str(DIAS[1]), jornales=0),  # al final faltó
        op("asistencia.marcar", obrero_id=juan, fecha=str(DIAS[3]), jornales=3),  # inválido
    )
    oks = [x["ok"] for x in r["resultados"]]
    assert oks == [True, True, True, True, True, False]
    assert "jornales" in r["resultados"][-1]["error"]
    asis = r["cambios"]["asistencias"]
    falta = next(a for a in asis if a["obrero_id"] == carlos and a["fecha"] == str(DIAS[1]))
    assert falta["jornales"] == 0  # la falta viaja como lápida

    adel = nuevo_id()
    otro = nuevo_id()
    r = cel.subir(
        op("adelanto.crear", id=adel, obrero_id=juan, monto=30000, fecha=str(DIAS[1]), nota="pidió"),
        op("adelanto.crear", id=otro, obrero_id=juan, monto=5000, fecha=str(DIAS[2])),
        op("adelanto.crear", id=nuevo_id(), obrero_id=juan, monto=0, fecha=str(DIAS[2])),
    )
    assert [x["ok"] for x in r["resultados"]] == [True, True, False]

    # Pago: Juan 1 + 2 + 1½ = 4½ jornales × 45.000 = 202.500, descuenta 30.000 de 35.000
    pago, item_j, item_c = nuevo_id(), nuevo_id(), nuevo_id()
    pagar = op(
        "pago.crear", id=pago, hasta=str(DIAS[4]), fecha=str(DIAS[4]), items=[
            {"id": item_j, "obrero_id": juan, "fechas": [str(d) for d in DIAS[:3]], "jornales": 4.5, "jornal": 45000,
             "bruto": 202500, "plus": 5000, "descuento": 30000, "neto": 177500, "nota": "plus"},
            {"id": item_c, "obrero_id": carlos, "fechas": [str(DIAS[0])], "jornales": 1, "jornal": 38000,
             "bruto": 38000, "descuento": 0, "neto": 38000},
        ],
    )
    r = cel.subir(pagar)
    assert r["resultados"][0]["ok"], r["resultados"]
    p = por_id(r["cambios"]["pagos"], pago)
    assert p["total_neto"] == 215500 and p["total_bruto"] == 240500 and p["total_plus"] == 5000
    pagados = [a for a in r["cambios"]["asistencias"] if a["pago_id"] == pago]
    assert len(pagados) == 4

    # Reintento del mismo pago: no se duplica
    r = cel.subir(pagar)
    assert r["resultados"][0]["ok"] and not r["cambios"]["pagos"]

    # Día pagado: bloqueado
    r = cel.subir(op("asistencia.marcar", obrero_id=juan, fecha=str(DIAS[0]), jornales=0))
    assert not r["resultados"][0]["ok"] and "pagado" in r["resultados"][0]["error"]
    # Pagar dos veces los mismos días: rechazado
    r = cel.subir(op("pago.crear", id=nuevo_id(), hasta=str(DIAS[4]), fecha=str(DIAS[4]), items=[
        {"id": nuevo_id(), "obrero_id": carlos, "fechas": [str(DIAS[0])], "jornales": 1, "jornal": 38000,
         "bruto": 38000, "descuento": 0, "neto": 38000}]))
    assert not r["resultados"][0]["ok"] and "ya se pagaron" in r["resultados"][0]["error"]
    # Cuentas que no cierran: rechazado
    cel.subir(op("asistencia.marcar", obrero_id=juan, fecha=str(DIAS[3]), jornales=1))
    r = cel.subir(op("pago.crear", id=nuevo_id(), hasta=str(DIAS[4]), fecha=str(DIAS[4]), items=[
        {"id": nuevo_id(), "obrero_id": juan, "fechas": [str(DIAS[3])], "jornales": 1, "jornal": 45000,
         "bruto": 45000, "descuento": 10000, "neto": 45000}]))
    assert not r["resultados"][0]["ok"]

    # Adelantos: el de 30.000 (más viejo) se descontó → no se borra; el de 5.000 sí
    r = cel.subir(op("adelanto.borrar", id=adel), op("adelanto.borrar", id=otro))
    assert [x["ok"] for x in r["resultados"]] == [False, True]
    assert "descontó" in r["resultados"][0]["error"]

    # Anular: los días vuelven a quedar sin pagar y el adelanto se puede borrar
    r = cel.subir(op("pago.anular", id=pago), op("adelanto.borrar", id=adel))
    assert all(x["ok"] for x in r["resultados"])
    assert por_id(r["cambios"]["pagos"], pago)["anulado"] is True
    liberados = [a for a in r["cambios"]["asistencias"] if a["obrero_id"] in (juan, carlos)]
    assert liberados and all(a["pago_id"] is None for a in liberados)


def test_herramientas_reparto_reclamo_y_cierre(cel):
    cu, juan, carlos, walter = armar_equipo(cel)
    otra = nuevo_id()
    amoladora, palas = nuevo_id(), nuevo_id()
    hoy = str(DIAS[4])
    adel_cargo = nuevo_id()
    r = cel.subir(
        op("cuadrilla.guardar", id=otra, nombre="Roldán", color="azul"),
        op("herramienta.crear", id=amoladora, nombre='Amoladora 9"', tipo="herramienta", cantidad=3, valor=120000, fecha=hoy),
        op("herramienta.crear", id=palas, nombre="Pala ancha", cantidad=10, valor=18000, cuadrilla_id=cu, fecha=hoy),
        op("herramienta.mover", desde=None, hacia=cu, items=[{"herramienta_id": amoladora, "cantidad": 2}], fecha=hoy),
        op("herramienta.mover", desde=None, hacia=cu, items=[{"herramienta_id": amoladora, "cantidad": 2}], fecha=hoy),
        op("herramienta.mover", desde=cu, hacia=otra, items=[{"herramienta_id": palas, "cantidad": 4}], fecha=hoy),
        op("herramienta.reclamo", herramienta_id=amoladora, cuadrilla_id=cu, tipo="rotura", cantidad=1, nota="sin protección",
           fecha=hoy, cargo={"adelanto_id": adel_cargo, "obrero_id": juan, "monto": 120000}),
        op("herramienta.cantidad", id=palas, delta=-5, motivo="baja", fecha=hoy),
        op("herramienta.borrar", id=palas),
        op("herramienta.mover", desde=cu, hacia=cu, items=[{"herramienta_id": palas, "cantidad": 1}], fecha=hoy),
    )
    oks = [x["ok"] for x in r["resultados"]]
    assert oks == [True, True, True, True, False, True, True, False, False, False], r["resultados"]
    assert "No alcanza" in r["resultados"][4]["error"]
    c = r["cambios"]
    stock = {(s["herramienta_id"], s["cuadrilla_id"]): s["cantidad"] for s in c["stock"]}
    assert stock[(amoladora, cu)] == 1 and stock[(palas, cu)] == 6 and stock[(palas, otra)] == 4
    assert por_id(c["herramientas"], amoladora)["cantidad"] == 2
    cargo = por_id(c["adelantos"], adel_cargo)
    assert cargo["tipo"] == "cargo" and cargo["monto"] == 120000 and "Rotura" in cargo["nota"]
    mov = por_id(c["movimientos"], cargo["movimiento_id"])
    assert mov["tipo"] == "rotura" and mov["responsable_id"] == juan

    # Cerrar la cuadrilla: todo vuelve al pañol y la gente queda libre
    r = cel.subir(op("cuadrilla.cerrar", id=cu, fecha=hoy))
    assert r["resultados"][0]["ok"]
    c = r["cambios"]
    assert all(s["cantidad"] == 0 for s in c["stock"] if s["cuadrilla_id"] == cu)
    assert por_id(c["cuadrillas"], cu)["activa"] is False
    assert all(o["cuadrilla_id"] is None for o in c["obreros"] if o["id"] in (juan, carlos))
    devoluciones = [m for m in c["movimientos"] if m["tipo"] == "devolucion" and m["desde_id"] == cu]
    assert {m["herramienta_id"] for m in devoluciones} == {amoladora, palas}
    r = cel.subir(op("obrero.guardar", id=walter, nombre="Walter Ruiz", rol="Ayudante", jornal=30000, cuadrilla_id=cu))
    assert not r["resultados"][0]["ok"]


def test_integrantes_y_encargado(cel):
    cu, juan, carlos, walter = armar_equipo(cel)
    otra = nuevo_id()
    r = cel.subir(
        op("cuadrilla.guardar", id=otra, nombre="Roldán", color="azul", encargado_id=carlos),  # Carlos se muda y es encargado
        op("cuadrilla.integrantes", id=cu, obrero_ids=[juan, walter]),
        op("obrero.baja", id=juan),
    )
    assert all(x["ok"] for x in r["resultados"]), r["resultados"]
    c = r["cambios"]
    obreros = {o["id"]: o for o in c["obreros"]}
    assert obreros[carlos]["cuadrilla_id"] == otra
    assert obreros[walter]["cuadrilla_id"] == cu
    assert obreros[juan]["activo"] is False and obreros[juan]["cuadrilla_id"] is None
    assert por_id(c["cuadrillas"], cu)["encargado_id"] is None  # Juan se dio de baja
    assert por_id(c["cuadrillas"], otra)["encargado_id"] == carlos


def test_operaciones_invalidas_no_traban_la_cola(cel):
    r = cel.subir({"id": "no-es-uuid", "tipo": "x", "ts": 1, "datos": {}}, op("cosa.rara", a=1), op("obrero.guardar", id=nuevo_id()))
    assert [x["ok"] for x in r["resultados"]] == [False, False, False]
    assert r["resultados"][0]["id"] == "no-es-uuid"


def test_pago_rechaza_jornal_desactualizado_corte_y_centavos(cel):
    _, juan, _, _ = armar_equipo(cel)
    cel.subir(op("asistencia.marcar", obrero_id=juan, fecha=str(DIAS[0]), jornales=1))
    item = {"id": nuevo_id(), "obrero_id": juan, "fechas": [str(DIAS[0])], "jornales": 1,
            "jornal": 45000, "bruto": 45000, "neto": 45000}
    casos = [
        ({**item, "jornal": 40000, "bruto": 40000, "neto": 40000}, str(DIAS[4]), "jornal cambió"),
        (item, str(DIAS[0] - timedelta(days=1)), "posteriores"),
        ({**item, "neto": 45000.50}, str(DIAS[4]), "no cierran"),
    ]
    for datos, hasta, mensaje in casos:
        r = cel.subir(op("pago.crear", id=nuevo_id(), hasta=hasta, fecha=str(DIAS[4]), items=[datos]))
        assert not r["resultados"][0]["ok"]
        assert mensaje in r["resultados"][0]["error"]
        assert not r["cambios"]["pagos"]
        assert not r["cambios"]["asistencias"]
    r = cel.subir(op("pago.crear", id=nuevo_id(), hasta=str(DIAS[4]), fecha=str(DIAS[4]), items=[item]))
    assert r["resultados"][0]["ok"]


def test_reintento_antiguo_no_duplica_entrega_tras_reiniciar(cel, http):
    from app.db import preparar
    cu, _, _, _ = armar_equipo(cel)
    herramienta = nuevo_id()
    cel.subir(op("herramienta.crear", id=herramienta, nombre="Pala", cantidad=4, fecha=str(DIAS[0])))
    entrega = op("herramienta.mover", desde=None, hacia=cu, fecha=str(DIAS[0]),
                 items=[{"herramienta_id": herramienta, "cantidad": 1}])
    assert cel.subir(entrega)["resultados"][0]["ok"]

    async def reiniciar():
        from uuid import UUID
        pool = http.app.state.pool
        async with pool.acquire() as c:
            await c.execute("UPDATE ops_aplicadas SET aplicada = now() - interval '121 days' WHERE id = $1", UUID(entrega["id"]))
        await preparar(pool)

    http.portal.call(reiniciar)
    assert cel.subir(entrega)["resultados"][0]["ok"]
    filas = cel.bajar(0)["cambios"]["stock"]
    assert next(f for f in filas if f["herramienta_id"] == herramienta and f["cuadrilla_id"] == cu)["cantidad"] == 1


def test_cambiar_clave_cierra_otras_sesiones(http):
    a, b = Celular(http), Celular(http)
    a.ingresar()
    b.ingresar()
    r = http.post("/api/auth/clave", json={"actual": "mal", "nueva": "nueva-clave"}, headers=a.cabeceras)
    assert r.status_code == 400
    r = http.post("/api/auth/clave", json={"actual": "clave-prueba", "nueva": "nueva-clave"}, headers=a.cabeceras)
    assert r.status_code == 200
    a.token = r.json()["token"]
    assert http.get("/api/sync", headers=a.cabeceras).status_code == 200
    assert http.get("/api/sync", headers=b.cabeceras).status_code == 401
    # vuelve a la clave original para el resto de las pruebas
    r = http.post("/api/auth/clave", json={"actual": "nueva-clave", "nueva": "clave-prueba"}, headers=a.cabeceras)
    assert r.status_code == 200
