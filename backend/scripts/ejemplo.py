"""Datos de ejemplo para probar la app (NO usar en producción).

    python -m scripts.ejemplo          carga el ejemplo si la base está vacía
    python -m scripts.ejemplo --reset  borra todo (menos usuarios) y lo vuelve a cargar
"""

import argparse
import asyncio
from datetime import date, datetime, time, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

from app import config, db
from app.calculos import hoy, r2, semana_de_pago

CUADRILLAS = [
    ("Plaza Funes", "Plaza principal · Funes", "naranja"),
    ("Roldán · Casa 4", "Tierra de Sueños 3, lote 112", "azul"),
    ("Pueblo Esther", "Galpón ruta 21 km 7", "verde"),
]

# nombre, rol, jornal, cuadrilla, encargado, teléfono
OBREROS = [
    ("Juan Pérez", "Oficial", 45000, 0, True, "3416123456"),
    ("Carlos Gómez", "Medio oficial", 38000, 0, False, ""),
    ("Matías Ríos", "Ayudante", 30000, 0, False, ""),
    ("Lucas Fernández", "Ayudante", 30000, 0, False, ""),
    ("Ramón Díaz", "Capataz", 55000, 1, True, "3415987654"),
    ("Diego Sosa", "Oficial", 45000, 1, False, ""),
    ("Hernán Rojas", "Oficial", 46000, 1, False, ""),
    ("Nicolás Acosta", "Ayudante", 31000, 1, False, ""),
    ("Brian Medina", "Ayudante", 30000, 1, False, ""),
    ("Sergio Molina", "Oficial", 45000, 2, True, ""),
    ("Pablo Benítez", "Medio oficial", 38000, 2, False, ""),
    ("Franco Ledesma", "Ayudante", 30000, 2, False, ""),
    ("Walter Ruiz", "Ayudante", 30000, None, False, ""),
]

# nombre, tipo, total, valor, reparto por cuadrilla
HERRAMIENTAS = [
    ("Hormigonera 150 L", "maquina", 2, 650000, (1, 1, 0)),
    ("Martillo demoledor", "maquina", 1, 600000, (0, 1, 0)),
    ("Generador 5 kVA", "maquina", 1, 900000, (0, 0, 1)),
    ("Vibrador de hormigón", "maquina", 1, 450000, (0, 0, 0)),
    ('Amoladora 9"', "herramienta", 4, 120000, (1, 1, 0)),
    ('Amoladora 4½"', "herramienta", 3, 70000, (1, 0, 1)),
    ("Taladro percutor", "herramienta", 3, 95000, (1, 1, 1)),
    ("Rotomartillo", "herramienta", 2, 280000, (0, 1, 0)),
    ("Cortadora de cerámica", "herramienta", 2, 90000, (0, 1, 0)),
    ("Andamio (cuerpo)", "herramienta", 20, 85000, (8, 8, 0)),
    ("Carretilla", "herramienta", 6, 75000, (2, 2, 1)),
    ("Pala ancha", "herramienta", 12, 18000, (4, 4, 2)),
    ("Pala de punta", "herramienta", 8, 18000, (2, 3, 2)),
    ("Balde albañil", "herramienta", 20, 4000, (6, 6, 4)),
    ("Nivel 60 cm", "herramienta", 5, 15000, (1, 2, 1)),
    ("Escalera 7 escalones", "herramienta", 3, 110000, (1, 1, 0)),
]


def azar(a: int, b: int) -> float:
    """Pseudoaleatorio estable: el ejemplo siempre sale igual."""
    return ((a * 9301 + b * 49297 + 7) % 233280) / 233280


def jornada(i: int, dia: date) -> float:
    x = azar(i + 1, dia.day + 3)
    if x < 0.08:
        return 0
    if x > 0.95:
        return 2
    if x > 0.9:
        return 1.5
    return 1


def momento(d: date) -> datetime:
    return datetime.combine(d, time(12), tzinfo=ZoneInfo(config.ZONA_HORARIA))


async def cargar(reset: bool) -> None:
    pool = await db.crear_pool()
    try:
        await db.preparar(pool)
        async with pool.acquire() as c:
            if await c.fetchval("SELECT EXISTS (SELECT 1 FROM obreros)") and not reset:
                print("Ya hay datos cargados. Usá --reset para borrar todo y cargar el ejemplo.")
                return
            async with c.transaction():
                await c.execute(
                    "TRUNCATE movimientos, herramienta_stock, herramientas, pago_items, adelantos, asistencias,"
                    " pagos, obreros, cuadrillas, ops_aplicadas CASCADE"
                )
                await _cargar(c)
    finally:
        await pool.close()
    print(f"Ejemplo cargado: {len(OBREROS)} obreros, {len(CUADRILLAS)} cuadrillas, {len(HERRAMIENTAS)} herramientas.")


async def _cargar(c) -> None:
    hoy_ = hoy()
    actual = semana_de_pago(hoy_)
    anterior = semana_de_pago(actual[0] - timedelta(days=1))

    cuadrillas = []
    for nombre, obra, color in CUADRILLAS:
        cid = uuid4()
        await c.execute("INSERT INTO cuadrillas (id, nombre, obra, color) VALUES ($1, $2, $3, $4)", cid, nombre, obra, color)
        cuadrillas.append(cid)

    obreros = []
    for nombre, rol, jornal, cuad, encargado, telefono in OBREROS:
        oid = uuid4()
        cid = cuadrillas[cuad] if cuad is not None else None
        await c.execute(
            "INSERT INTO obreros (id, nombre, rol, jornal, telefono, cuadrilla_id) VALUES ($1, $2, $3, $4, $5, $6)",
            oid, nombre, rol, jornal, telefono, cid,
        )
        if encargado:
            await c.execute("UPDATE cuadrillas SET encargado_id = $1 WHERE id = $2", oid, cid)
        obreros.append({"id": oid, "nombre": nombre, "jornal": jornal, "cuad": cuad})
    por_nombre = {o["nombre"].split()[0]: o for o in obreros}

    async def marcar(dia: date, solo=None):
        if dia.weekday() == 6:  # domingo
            return
        for i, o in enumerate(obreros):
            if solo is not None and o["cuad"] not in solo:
                continue
            if dia.weekday() == 5 and o["cuad"] != 1:  # los sábados sólo trabaja Roldán
                continue
            j = 0.5 if dia.weekday() == 5 else jornada(i, dia)
            if j:
                await c.execute("INSERT INTO asistencias (obrero_id, fecha, jornales) VALUES ($1, $2, $3)", o["id"], dia, j)

    d = anterior[0]
    while d <= anterior[1]:
        await marcar(d)
        d += timedelta(days=1)
    d = actual[0]
    while d < hoy_ and d <= actual[1]:
        await marcar(d)
        d += timedelta(days=1)
    if hoy_ <= actual[1]:
        await marcar(hoy_, solo={0, 1})  # hoy sólo pasaron lista dos cuadrillas

    async def adelanto(nombre, monto, dia, nota=""):
        await c.execute(
            "INSERT INTO adelantos (id, obrero_id, monto, fecha, nota, creado) VALUES ($1, $2, $3, $4, $5, $6)",
            uuid4(), por_nombre[nombre]["id"], monto, dia, nota, momento(dia),
        )

    await adelanto("Diego", 40000, anterior[0] + timedelta(days=4), "Para el alquiler")

    # Pago de la semana anterior (descontando todo).
    pago_id = uuid4()
    filas = []
    for o in obreros:
        dias = await c.fetch(
            "SELECT fecha, jornales FROM asistencias WHERE obrero_id = $1 AND fecha <= $2 ORDER BY fecha", o["id"], anterior[1]
        )
        if not dias:
            continue
        jornales = sum(x["jornales"] for x in dias)
        bruto = r2(jornales * o["jornal"])
        descuento = 40000 if o["nombre"].startswith("Diego") else 0
        filas.append((o, [x["fecha"] for x in dias], jornales, bruto, descuento))
    total = lambda i: r2(sum(f[i] for f in filas))  # noqa: E731
    await c.execute(
        """INSERT INTO pagos (id, hasta, fecha, total_bruto, total_descuentos, total_neto, creado)
           VALUES ($1, $2, $2, $3, $4, $5, $6)""",
        pago_id, anterior[1], total(3), total(4), r2(total(3) - total(4)), momento(anterior[1]),
    )
    for o, fechas, jornales, bruto, descuento in filas:
        await c.execute(
            """INSERT INTO pago_items (id, pago_id, obrero_id, fechas, dias, jornales, jornal, bruto, descuento, neto)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)""",
            uuid4(), pago_id, o["id"], fechas, len(fechas), jornales, o["jornal"], bruto, descuento, r2(bruto - descuento),
        )
        await c.execute("UPDATE asistencias SET pago_id = $1 WHERE obrero_id = $2 AND fecha = ANY($3::date[])", pago_id, o["id"], fechas)

    lunes = actual[0] + timedelta(days=2)
    en_semana = lambda n: min(lunes + timedelta(days=n), hoy_)  # noqa: E731
    await adelanto("Juan", 30000, en_semana(1))
    await adelanto("Matías", 20000, en_semana(2), "Remedios")
    await adelanto("Diego", 50000, en_semana(3))

    # Herramientas y reparto
    inicio = anterior[0] - timedelta(days=30)
    encargados = {cid: await c.fetchval("SELECT encargado_id FROM cuadrillas WHERE id = $1", cid) for cid in cuadrillas}
    ids_h = {}
    for nombre, tipo, total_h, valor, reparto in HERRAMIENTAS:
        hid = uuid4()
        ids_h[nombre] = hid
        await c.execute(
            "INSERT INTO herramientas (id, nombre, tipo, cantidad, valor) VALUES ($1, $2, $3, $4, $5)", hid, nombre, tipo, total_h, valor
        )
        await c.execute(
            "INSERT INTO movimientos (id, herramienta_id, tipo, cantidad, fecha, creado) VALUES ($1, $2, 'alta', $3, $4, $5)",
            uuid4(), hid, total_h, inicio, momento(inicio),
        )
        for i, cant in enumerate(reparto):
            if not cant:
                continue
            cid = cuadrillas[i]
            dia = inicio + timedelta(days=i + 1)
            await c.execute("INSERT INTO herramienta_stock (herramienta_id, cuadrilla_id, cantidad) VALUES ($1, $2, $3)", hid, cid, cant)
            await c.execute(
                """INSERT INTO movimientos (id, herramienta_id, tipo, cantidad, hacia_id, responsable_id, fecha, creado)
                   VALUES ($1, $2, 'entrega', $3, $4, $5, $6, $7)""",
                uuid4(), hid, cant, cid, encargados[cid], dia, momento(dia),
            )

    # Un reclamo: amoladora rota en Roldán, cobrada al encargado.
    amoladora, roldan, ramon = ids_h['Amoladora 9"'], cuadrillas[1], por_nombre["Ramón"]["id"]
    dia = en_semana(2)
    await c.execute("UPDATE herramienta_stock SET cantidad = cantidad - 1 WHERE herramienta_id = $1 AND cuadrilla_id = $2", amoladora, roldan)
    await c.execute("UPDATE herramientas SET cantidad = cantidad - 1 WHERE id = $1", amoladora)
    mov = uuid4()
    await c.execute(
        """INSERT INTO movimientos (id, herramienta_id, tipo, cantidad, desde_id, responsable_id, cargo, nota, fecha, creado)
           VALUES ($1, $2, 'rotura', 1, $3, $4, 25000, 'Se usó sin la protección', $5, $6)""",
        mov, amoladora, roldan, ramon, dia, momento(dia),
    )
    await c.execute(
        """INSERT INTO adelantos (id, obrero_id, tipo, monto, fecha, nota, movimiento_id, creado)
           VALUES ($1, $2, 'cargo', 25000, $3, $4, $5, $6)""",
        uuid4(), ramon, dia, 'Rotura por mal uso: Amoladora 9" (Roldán · Casa 4)', mov, momento(dia),
    )


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--reset", action="store_true", help="borra todo (menos usuarios) antes de cargar")
    asyncio.run(cargar(p.parse_args().reset))


if __name__ == "__main__":
    main()
