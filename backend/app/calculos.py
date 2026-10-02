"""Reglas de cuentas (ver docs/DISENO.md §5). El celular aplica las mismas."""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from . import config


def r2(n: float) -> float:
    return round(float(n) + 1e-9, 2)


def estado_adelantos(adelantos: list[dict], descontado: float) -> dict:
    """Reparte lo ya descontado entre los adelantos, del más viejo al más nuevo.

    adelantos: [{id, monto, creado}] (sin anulados). Devuelve {id: (descontado, pendiente)}.
    """
    resto = r2(max(0.0, descontado))
    estado = {}
    for a in sorted(adelantos, key=lambda x: (x["creado"], str(x["id"]))):
        usado = r2(min(resto, a["monto"]))
        resto = r2(resto - usado)
        estado[a["id"]] = (usado, r2(a["monto"] - usado))
    return estado


def hoy() -> date:
    return datetime.now(ZoneInfo(config.ZONA_HORARIA)).date()


VIERNES = 4  # date.weekday(): lunes = 0


def semana_de_pago(fecha: date) -> tuple[date, date]:
    """La semana de pago va de sábado a viernes."""
    hasta = fecha + timedelta(days=(VIERNES - fecha.weekday()) % 7)
    return hasta - timedelta(days=6), hasta
