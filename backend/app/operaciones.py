"""Aplicación de operaciones en el servidor.

Cada operación la generó el celular (con o sin señal) y llega por /api/sync. Se aplican
en orden; si una no es válida se rechaza con un mensaje para mostrarle al usuario.
El motor del celular (frontend/src/motor/reducir.js) aplica exactamente las mismas reglas.
"""

from dataclasses import dataclass
from typing import Awaitable, Callable
from uuid import UUID, uuid4

import asyncpg
from pydantic import BaseModel

from . import modelos as m
from .calculos import estado_adelantos, r2

RECLAMOS = {"robo": "Robo", "faltante": "Faltante", "rotura": "Rotura por mal uso"}


class Rechazo(Exception):
    """La operación no se puede aplicar; el mensaje se le muestra al usuario."""


@dataclass
class Contexto:
    op: m.Op
    usuario_id: int


# ── Ayudantes ────────────────────────────────────────────────────────────


async def nombre_obrero(c: asyncpg.Connection, obrero_id: UUID) -> str:
    return await c.fetchval("SELECT nombre FROM obreros WHERE id = $1", obrero_id) or "el obrero"


async def obrero_existente(c: asyncpg.Connection, obrero_id: UUID) -> asyncpg.Record:
    o = await c.fetchrow("SELECT id, nombre, activo FROM obreros WHERE id = $1", obrero_id)
    if o is None:
        raise Rechazo("El obrero no existe.")
    return o


async def cuadrilla_activa(c: asyncpg.Connection, cuadrilla_id: UUID | None, bloquear: bool = False):
    if cuadrilla_id is None:
        return None
    sql = "SELECT id, nombre, encargado_id, activa FROM cuadrillas WHERE id = $1" + (" FOR UPDATE" if bloquear else "")
    cu = await c.fetchrow(sql, cuadrilla_id)
    if cu is None or not cu["activa"]:
        raise Rechazo("La cuadrilla no existe o ya se cerró.")
    return cu


async def deuda_de(c: asyncpg.Connection, obrero_id: UUID) -> tuple[float, float]:
    """(adelantos pendientes de descontar, total ya descontado)."""
    adelantos = await c.fetchval(
        "SELECT COALESCE(SUM(monto), 0) FROM adelantos WHERE obrero_id = $1 AND NOT anulado", obrero_id
    )
    descontado = await c.fetchval(
        """SELECT COALESCE(SUM(i.descuento), 0) FROM pago_items i JOIN pagos p ON p.id = i.pago_id
            WHERE i.obrero_id = $1 AND NOT p.anulado""",
        obrero_id,
    )
    return r2(max(0.0, adelantos - descontado)), r2(descontado)


async def registrar_movimiento(c: asyncpg.Connection, **mov) -> UUID:
    mov_id = mov.pop("id", None) or uuid4()
    await c.execute(
        """INSERT INTO movimientos (id, herramienta_id, tipo, cantidad, desde_id, hacia_id, responsable_id, cargo, nota, fecha)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)""",
        mov_id,
        mov["herramienta_id"],
        mov["tipo"],
        mov["cantidad"],
        mov.get("desde_id"),
        mov.get("hacia_id"),
        mov.get("responsable_id"),
        mov.get("cargo", 0),
        mov.get("nota", ""),
        mov["fecha"],
    )
    return mov_id


async def herramienta_bloqueada(c: asyncpg.Connection, herramienta_id: UUID) -> dict:
    h = await c.fetchrow(
        "SELECT id, nombre, cantidad, valor, activo FROM herramientas WHERE id = $1 FOR UPDATE", herramienta_id
    )
    if h is None or not h["activo"]:
        raise Rechazo("La herramienta no existe.")
    asignado = await c.fetchval(
        "SELECT COALESCE(SUM(cantidad), 0) FROM herramienta_stock WHERE herramienta_id = $1", herramienta_id
    )
    return {**dict(h), "asignado": asignado, "panol": h["cantidad"] - asignado}


async def en_cuadrilla(c: asyncpg.Connection, herramienta_id: UUID, cuadrilla_id: UUID) -> int:
    n = await c.fetchval(
        "SELECT cantidad FROM herramienta_stock WHERE herramienta_id = $1 AND cuadrilla_id = $2 FOR UPDATE",
        herramienta_id,
        cuadrilla_id,
    )
    return n or 0


async def sumar_stock(c: asyncpg.Connection, herramienta_id: UUID, cuadrilla_id: UUID, delta: int) -> None:
    if delta < 0:  # restar: la fila ya existe (se validó que alcanza)
        await c.execute(
            "UPDATE herramienta_stock SET cantidad = cantidad + $3 WHERE herramienta_id = $1 AND cuadrilla_id = $2",
            herramienta_id,
            cuadrilla_id,
            delta,
        )
        return
    await c.execute(
        """INSERT INTO herramienta_stock (herramienta_id, cuadrilla_id, cantidad) VALUES ($1, $2, $3)
           ON CONFLICT (herramienta_id, cuadrilla_id) DO UPDATE SET cantidad = herramienta_stock.cantidad + EXCLUDED.cantidad""",
        herramienta_id,
        cuadrilla_id,
        delta,
    )


# ── Obreros ──────────────────────────────────────────────────────────────


async def obrero_guardar(c, d: m.ObreroGuardar, ctx: Contexto):
    await cuadrilla_activa(c, d.cuadrilla_id)
    previo = await c.fetchrow("SELECT cuadrilla_id FROM obreros WHERE id = $1 FOR UPDATE", d.id)
    if previo is None:
        await c.execute(
            """INSERT INTO obreros (id, nombre, rol, jornal, telefono, nota, cuadrilla_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7)""",
            d.id, d.nombre, d.rol, d.jornal, d.telefono, d.nota, d.cuadrilla_id,
        )
        return
    await c.execute(
        "UPDATE obreros SET nombre = $2, rol = $3, jornal = $4, telefono = $5, nota = $6, cuadrilla_id = $7 WHERE id = $1",
        d.id, d.nombre, d.rol, d.jornal, d.telefono, d.nota, d.cuadrilla_id,
    )
    if previo["cuadrilla_id"] != d.cuadrilla_id:
        # Si se fue de la cuadrilla, deja de ser su encargado.
        await c.execute(
            "UPDATE cuadrillas SET encargado_id = NULL WHERE encargado_id = $1 AND id IS DISTINCT FROM $2", d.id, d.cuadrilla_id
        )


async def obrero_baja(c, d: m.SoloId, ctx: Contexto):
    await obrero_existente(c, d.id)
    await c.execute("UPDATE obreros SET activo = FALSE, cuadrilla_id = NULL WHERE id = $1", d.id)
    await c.execute("UPDATE cuadrillas SET encargado_id = NULL WHERE encargado_id = $1", d.id)


async def obrero_alta(c, d: m.SoloId, ctx: Contexto):
    await obrero_existente(c, d.id)
    await c.execute("UPDATE obreros SET activo = TRUE WHERE id = $1 AND NOT activo", d.id)


# ── Cuadrillas ───────────────────────────────────────────────────────────


async def poner_encargado(c, cuadrilla_id: UUID, obrero_id: UUID | None):
    if obrero_id is None:
        await c.execute("UPDATE cuadrillas SET encargado_id = NULL WHERE id = $1 AND encargado_id IS NOT NULL", cuadrilla_id)
        return
    o = await obrero_existente(c, obrero_id)
    if not o["activo"]:
        raise Rechazo(f"{o['nombre']} está dado de baja.")
    # El encargado tiene que ser integrante: si no lo es, se lo suma.
    await c.execute("UPDATE cuadrillas SET encargado_id = NULL WHERE encargado_id = $1 AND id <> $2", obrero_id, cuadrilla_id)
    await c.execute(
        "UPDATE obreros SET cuadrilla_id = $2 WHERE id = $1 AND cuadrilla_id IS DISTINCT FROM $2", obrero_id, cuadrilla_id
    )
    await c.execute(
        "UPDATE cuadrillas SET encargado_id = $2 WHERE id = $1 AND encargado_id IS DISTINCT FROM $2", cuadrilla_id, obrero_id
    )


async def cuadrilla_guardar(c, d: m.CuadrillaGuardar, ctx: Contexto):
    previa = await c.fetchrow("SELECT activa FROM cuadrillas WHERE id = $1 FOR UPDATE", d.id)
    if previa is None:
        await c.execute(
            "INSERT INTO cuadrillas (id, nombre, obra, color) VALUES ($1, $2, $3, $4)", d.id, d.nombre, d.obra, d.color
        )
    elif not previa["activa"]:
        raise Rechazo("Esa cuadrilla ya se cerró.")
    else:
        await c.execute("UPDATE cuadrillas SET nombre = $2, obra = $3, color = $4 WHERE id = $1", d.id, d.nombre, d.obra, d.color)
    await poner_encargado(c, d.id, d.encargado_id)


async def cuadrilla_integrantes(c, d: m.CuadrillaIntegrantes, ctx: Contexto):
    cu = await cuadrilla_activa(c, d.id, bloquear=True)
    ids = list(dict.fromkeys(d.obrero_ids))
    await c.execute(
        "UPDATE obreros SET cuadrilla_id = NULL WHERE cuadrilla_id = $1 AND NOT (id = ANY($2::uuid[]))", d.id, ids
    )
    if ids:
        await c.execute(
            "UPDATE cuadrillas SET encargado_id = NULL WHERE encargado_id = ANY($1::uuid[]) AND id <> $2", ids, d.id
        )
        await c.execute(
            "UPDATE obreros SET cuadrilla_id = $1 WHERE id = ANY($2::uuid[]) AND activo AND cuadrilla_id IS DISTINCT FROM $1",
            d.id,
            ids,
        )
    if cu["encargado_id"] and cu["encargado_id"] not in ids:
        await c.execute("UPDATE cuadrillas SET encargado_id = NULL WHERE id = $1", d.id)


async def cuadrilla_cerrar(c, d: m.CuadrillaCerrar, ctx: Contexto):
    cu = await c.fetchrow("SELECT id, encargado_id, activa FROM cuadrillas WHERE id = $1 FOR UPDATE", d.id)
    if cu is None:
        raise Rechazo("La cuadrilla no existe.")
    if not cu["activa"]:
        return
    stock = await c.fetch(
        "SELECT herramienta_id, cantidad FROM herramienta_stock WHERE cuadrilla_id = $1 AND cantidad > 0 FOR UPDATE", d.id
    )
    for s in stock:
        await registrar_movimiento(
            c,
            herramienta_id=s["herramienta_id"],
            tipo="devolucion",
            cantidad=s["cantidad"],
            desde_id=d.id,
            responsable_id=cu["encargado_id"],
            nota="Cierre de cuadrilla",
            fecha=d.fecha,
        )
    await c.execute("UPDATE herramienta_stock SET cantidad = 0 WHERE cuadrilla_id = $1 AND cantidad > 0", d.id)
    await c.execute("UPDATE obreros SET cuadrilla_id = NULL WHERE cuadrilla_id = $1", d.id)
    await c.execute("UPDATE cuadrillas SET activa = FALSE, encargado_id = NULL WHERE id = $1", d.id)


# ── Asistencia ───────────────────────────────────────────────────────────


async def _marcar(c, obrero_id: UUID, fecha, jornales: float, nota: str | None, saltear_pagados: bool):
    fila = await c.fetchrow(
        "SELECT jornales, nota, pago_id FROM asistencias WHERE obrero_id = $1 AND fecha = $2 FOR UPDATE", obrero_id, fecha
    )
    if fila is not None and fila["pago_id"] is not None:
        if saltear_pagados:
            return
        raise Rechazo(f"El {fecha:%d/%m} de {await nombre_obrero(c, obrero_id)} ya está pagado. Para cambiarlo, anulá el pago.")
    nueva_nota = nota if nota is not None else (fila["nota"] if fila else "")
    if fila is None:
        if jornales == 0:
            return
        await obrero_existente(c, obrero_id)
        await c.execute(
            "INSERT INTO asistencias (obrero_id, fecha, jornales, nota) VALUES ($1, $2, $3, $4)",
            obrero_id, fecha, jornales, nueva_nota,
        )
    elif fila["jornales"] != jornales or fila["nota"] != nueva_nota:
        await c.execute(
            "UPDATE asistencias SET jornales = $3, nota = $4 WHERE obrero_id = $1 AND fecha = $2",
            obrero_id, fecha, jornales, nueva_nota,
        )


async def asistencia_marcar(c, d: m.AsistenciaMarcar, ctx: Contexto):
    await _marcar(c, d.obrero_id, d.fecha, d.jornales, d.nota, saltear_pagados=False)


async def asistencia_lote(c, d: m.AsistenciaLote, ctx: Contexto):
    for it in d.items:
        await _marcar(c, it.obrero_id, d.fecha, it.jornales, None, saltear_pagados=True)


# ── Adelantos ────────────────────────────────────────────────────────────


async def adelanto_crear(c, d: m.AdelantoCrear, ctx: Contexto):
    await obrero_existente(c, d.obrero_id)
    if await c.fetchval("SELECT EXISTS (SELECT 1 FROM adelantos WHERE id = $1)", d.id):
        raise Rechazo("Ese adelanto ya estaba cargado.")
    await c.execute(
        """INSERT INTO adelantos (id, obrero_id, tipo, monto, fecha, nota, creado)
           VALUES ($1, $2, 'adelanto', $3, $4, $5, to_timestamp($6 / 1000.0))""",
        d.id, d.obrero_id, d.monto, d.fecha, d.nota, ctx.op.ts,
    )


async def adelanto_borrar(c, d: m.SoloId, ctx: Contexto):
    a = await c.fetchrow("SELECT obrero_id, anulado FROM adelantos WHERE id = $1 FOR UPDATE", d.id)
    if a is None:
        raise Rechazo("El adelanto no existe.")
    if a["anulado"]:
        return
    filas = await c.fetch(
        "SELECT id, monto, creado FROM adelantos WHERE obrero_id = $1 AND NOT anulado", a["obrero_id"]
    )
    _, descontado = await deuda_de(c, a["obrero_id"])
    if estado_adelantos([dict(f) for f in filas], descontado)[d.id][0] > 0:
        raise Rechazo("Ese adelanto ya se descontó en un pago. Para borrarlo, anulá ese pago.")
    await c.execute("UPDATE adelantos SET anulado = TRUE WHERE id = $1", d.id)


# ── Pagos ────────────────────────────────────────────────────────────────


async def pago_crear(c, d: m.PagoCrear, ctx: Contexto):
    if await c.fetchval("SELECT EXISTS (SELECT 1 FROM pagos WHERE id = $1)", d.id):
        raise Rechazo("Ese pago ya estaba registrado.")
    if len({it.obrero_id for it in d.items}) != len(d.items):
        raise Rechazo("Un obrero aparece dos veces en el pago.")

    for it in d.items:
        nombre = await nombre_obrero(c, it.obrero_id)
        fechas = sorted(set(it.fechas))
        vigente = await c.fetchval("SELECT jornal FROM obreros WHERE id = $1", it.obrero_id)
        if vigente is None or r2(vigente) != r2(it.jornal):
            raise Rechazo(f"{nombre}: el jornal cambió. Revisá el pago y volvé a confirmarlo.")
        if any(f > d.hasta for f in fechas):
            raise Rechazo(f"{nombre}: hay días posteriores al corte del pago.")
        if r2(it.bruto) != r2(it.jornales * it.jornal) or r2(it.neto) != r2(it.bruto + it.plus - it.descuento):
            raise Rechazo(f"{nombre}: las cuentas del pago no cierran.")
        if it.descuento > it.bruto + it.plus + 0.01:
            raise Rechazo(f"{nombre}: el descuento supera lo que cobra.")
        dias = await c.fetch(
            "SELECT fecha, jornales, pago_id FROM asistencias WHERE obrero_id = $1 AND fecha = ANY($2::date[]) FOR UPDATE",
            it.obrero_id,
            fechas,
        )
        if len(dias) != len(fechas) or any(x["jornales"] == 0 or x["pago_id"] is not None for x in dias):
            raise Rechazo(f"{nombre}: hay días que ya se pagaron o cambiaron. Revisá el pago y volvé a confirmarlo.")
        if abs(sum(x["jornales"] for x in dias) - it.jornales) > 0.01:
            raise Rechazo(f"{nombre}: los días cambiaron desde que se armó el pago. Revisalo y volvé a confirmarlo.")
        deuda, _ = await deuda_de(c, it.obrero_id)
        if it.descuento > deuda + 0.01:
            raise Rechazo(f"{nombre}: el descuento supera los adelantos pendientes.")

    totales = [r2(sum(getattr(it, k) for it in d.items)) for k in ("bruto", "plus", "descuento", "neto")]
    await c.execute(
        """INSERT INTO pagos (id, hasta, fecha, total_bruto, total_plus, total_descuentos, total_neto, nota)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
        d.id, d.hasta, d.fecha, *totales, d.nota,
    )
    for it in d.items:
        fechas = sorted(set(it.fechas))
        await c.execute(
            """INSERT INTO pago_items (id, pago_id, obrero_id, fechas, dias, jornales, jornal, bruto, plus, descuento, neto, nota)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)""",
            it.id, d.id, it.obrero_id, fechas, len(fechas), it.jornales, it.jornal, it.bruto, it.plus, it.descuento, it.neto, it.nota,
        )
        await c.execute(
            "UPDATE asistencias SET pago_id = $1 WHERE obrero_id = $2 AND fecha = ANY($3::date[])", d.id, it.obrero_id, fechas
        )


async def pago_anular(c, d: m.SoloId, ctx: Contexto):
    p = await c.fetchrow("SELECT anulado FROM pagos WHERE id = $1 FOR UPDATE", d.id)
    if p is None:
        raise Rechazo("El pago no existe.")
    if p["anulado"]:
        return
    await c.execute("UPDATE pagos SET anulado = TRUE WHERE id = $1", d.id)
    await c.execute("UPDATE asistencias SET pago_id = NULL WHERE pago_id = $1", d.id)


# ── Herramientas ─────────────────────────────────────────────────────────


async def herramienta_crear(c, d: m.HerramientaCrear, ctx: Contexto):
    if await c.fetchval("SELECT EXISTS (SELECT 1 FROM herramientas WHERE id = $1)", d.id):
        raise Rechazo("Esa herramienta ya estaba cargada.")
    cu = await cuadrilla_activa(c, d.cuadrilla_id)
    await c.execute(
        "INSERT INTO herramientas (id, nombre, tipo, cantidad, valor, nota) VALUES ($1, $2, $3, $4, $5, $6)",
        d.id, d.nombre, d.tipo, d.cantidad, d.valor, d.nota,
    )
    await registrar_movimiento(c, herramienta_id=d.id, tipo="alta", cantidad=d.cantidad, fecha=d.fecha)
    if cu:
        await sumar_stock(c, d.id, cu["id"], d.cantidad)
        await registrar_movimiento(
            c, herramienta_id=d.id, tipo="entrega", cantidad=d.cantidad, hacia_id=cu["id"],
            responsable_id=cu["encargado_id"], fecha=d.fecha,
        )


async def herramienta_editar(c, d: m.HerramientaEditar, ctx: Contexto):
    await herramienta_bloqueada(c, d.id)
    await c.execute(
        "UPDATE herramientas SET nombre = $2, tipo = $3, valor = $4, nota = $5 WHERE id = $1", d.id, d.nombre, d.tipo, d.valor, d.nota
    )


async def herramienta_cantidad(c, d: m.HerramientaCantidad, ctx: Contexto):
    h = await herramienta_bloqueada(c, d.id)
    nueva = h["cantidad"] + d.delta
    if nueva < h["asignado"]:
        raise Rechazo(f"Hay {h['asignado']} de \"{h['nombre']}\" en obras: el total no puede quedar en {max(nueva, 0)}.")
    await c.execute("UPDATE herramientas SET cantidad = $2 WHERE id = $1", d.id, nueva)
    await registrar_movimiento(
        c, herramienta_id=d.id, tipo="alta" if d.delta > 0 else "ajuste", cantidad=abs(d.delta), nota=d.motivo, fecha=d.fecha
    )


async def herramienta_borrar(c, d: m.SoloId, ctx: Contexto):
    h = await herramienta_bloqueada(c, d.id)
    if h["asignado"] > 0:
        raise Rechazo(f"Hay {h['asignado']} de \"{h['nombre']}\" en obras. Devolvelas al pañol antes de borrarla.")
    await c.execute("UPDATE herramientas SET activo = FALSE WHERE id = $1", d.id)


async def herramienta_mover(c, d: m.HerramientaMover, ctx: Contexto):
    desde = await cuadrilla_activa(c, d.desde)
    hacia = await cuadrilla_activa(c, d.hacia)
    tipo = "entrega" if desde is None else "devolucion" if hacia is None else "traslado"
    responsable = desde["encargado_id"] if tipo == "devolucion" else hacia["encargado_id"]
    for it in d.items:
        h = await herramienta_bloqueada(c, it.herramienta_id)
        hay = await en_cuadrilla(c, h["id"], desde["id"]) if desde else h["panol"]
        if hay < it.cantidad:
            lugar = desde["nombre"] if desde else "el pañol"
            raise Rechazo(f"No alcanza \"{h['nombre']}\": en {lugar} hay {hay}.")
        if desde:
            await sumar_stock(c, h["id"], desde["id"], -it.cantidad)
        if hacia:
            await sumar_stock(c, h["id"], hacia["id"], it.cantidad)
        await registrar_movimiento(
            c, herramienta_id=h["id"], tipo=tipo, cantidad=it.cantidad, desde_id=d.desde, hacia_id=d.hacia,
            responsable_id=responsable, nota=d.nota, fecha=d.fecha,
        )


async def herramienta_reclamo(c, d: m.HerramientaReclamo, ctx: Contexto):
    cu = await cuadrilla_activa(c, d.cuadrilla_id)
    h = await herramienta_bloqueada(c, d.herramienta_id)
    hay = await en_cuadrilla(c, h["id"], cu["id"]) if cu else h["panol"]
    if hay < d.cantidad:
        raise Rechazo(f"No alcanza \"{h['nombre']}\": en {cu['nombre'] if cu else 'el pañol'} hay {hay}.")
    if cu:
        await sumar_stock(c, h["id"], cu["id"], -d.cantidad)
    await c.execute("UPDATE herramientas SET cantidad = cantidad - $2 WHERE id = $1", h["id"], d.cantidad)
    mov_id = await registrar_movimiento(
        c, herramienta_id=h["id"], tipo=d.tipo, cantidad=d.cantidad, desde_id=d.cuadrilla_id,
        responsable_id=cu["encargado_id"] if cu else None, cargo=d.cargo.monto if d.cargo else 0, nota=d.nota, fecha=d.fecha,
    )
    if d.cargo:
        await obrero_existente(c, d.cargo.obrero_id)
        cuantas = f"{d.cantidad} × " if d.cantidad > 1 else ""
        donde = f" ({cu['nombre']})" if cu else ""
        detalle = f"{RECLAMOS[d.tipo]}: {cuantas}{h['nombre']}{donde}"
        await c.execute(
            """INSERT INTO adelantos (id, obrero_id, tipo, monto, fecha, nota, movimiento_id, creado)
               VALUES ($1, $2, 'cargo', $3, $4, $5, $6, to_timestamp($7 / 1000.0))""",
            d.cargo.adelanto_id, d.cargo.obrero_id, d.cargo.monto, d.fecha, detalle[:255], mov_id, ctx.op.ts,
        )


# ── Registro ─────────────────────────────────────────────────────────────


@dataclass
class Tipo:
    modelo: type[BaseModel]
    aplicar: Callable[..., Awaitable[None]]


OPERACIONES: dict[str, Tipo] = {
    "obrero.guardar": Tipo(m.ObreroGuardar, obrero_guardar),
    "obrero.baja": Tipo(m.SoloId, obrero_baja),
    "obrero.alta": Tipo(m.SoloId, obrero_alta),
    "cuadrilla.guardar": Tipo(m.CuadrillaGuardar, cuadrilla_guardar),
    "cuadrilla.integrantes": Tipo(m.CuadrillaIntegrantes, cuadrilla_integrantes),
    "cuadrilla.cerrar": Tipo(m.CuadrillaCerrar, cuadrilla_cerrar),
    "asistencia.marcar": Tipo(m.AsistenciaMarcar, asistencia_marcar),
    "asistencia.lote": Tipo(m.AsistenciaLote, asistencia_lote),
    "adelanto.crear": Tipo(m.AdelantoCrear, adelanto_crear),
    "adelanto.borrar": Tipo(m.SoloId, adelanto_borrar),
    "pago.crear": Tipo(m.PagoCrear, pago_crear),
    "pago.anular": Tipo(m.SoloId, pago_anular),
    "herramienta.crear": Tipo(m.HerramientaCrear, herramienta_crear),
    "herramienta.editar": Tipo(m.HerramientaEditar, herramienta_editar),
    "herramienta.cantidad": Tipo(m.HerramientaCantidad, herramienta_cantidad),
    "herramienta.borrar": Tipo(m.SoloId, herramienta_borrar),
    "herramienta.mover": Tipo(m.HerramientaMover, herramienta_mover),
    "herramienta.reclamo": Tipo(m.HerramientaReclamo, herramienta_reclamo),
}
