"""Forma de cada operación (lo que manda el celular)."""

from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

Texto = Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)]
Nombre = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Plata = Annotated[float, Field(ge=0, le=1e10)]
Positivo = Annotated[float, Field(gt=0, le=1e10)]
Cantidad = Annotated[int, Field(ge=1, le=100_000)]

JORNADAS = (0, 0.5, 1, 1.5, 2)
COLORES = Literal["naranja", "azul", "verde", "violeta", "rosa", "celeste", "amarillo", "gris"]


class Base(BaseModel):
    model_config = ConfigDict(extra="ignore")


class Op(Base):
    id: UUID
    tipo: str = Field(max_length=40)
    ts: int = Field(ge=0)  # milisegundos, hora del celular
    datos: dict


class SoloId(Base):
    id: UUID


class ObreroGuardar(Base):
    id: UUID
    nombre: Nombre
    rol: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    jornal: Plata
    telefono: Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)] = ""
    nota: Texto = ""
    cuadrilla_id: UUID | None = None


class CuadrillaGuardar(Base):
    id: UUID
    nombre: Nombre
    obra: Texto = ""
    color: COLORES = "naranja"
    encargado_id: UUID | None = None


class CuadrillaIntegrantes(Base):
    id: UUID
    obrero_ids: list[UUID] = Field(default_factory=list, max_length=500)


class CuadrillaCerrar(Base):
    id: UUID
    fecha: date


def _jornada(v: float) -> float:
    if v not in JORNADAS:
        raise ValueError("jornada inválida (0, ½, 1, 1½ o 2)")
    return float(v)


class AsistenciaMarcar(Base):
    obrero_id: UUID
    fecha: date
    jornales: float
    nota: Texto | None = None

    @field_validator("jornales")
    @classmethod
    def _validar_jornada(cls, v: float) -> float:
        return _jornada(v)


class ItemLote(Base):
    obrero_id: UUID
    jornales: float

    @field_validator("jornales")
    @classmethod
    def _validar_jornada(cls, v: float) -> float:
        return _jornada(v)


class AsistenciaLote(Base):
    fecha: date
    items: list[ItemLote] = Field(min_length=1, max_length=500)


class AdelantoCrear(Base):
    id: UUID
    obrero_id: UUID
    monto: Positivo
    fecha: date
    nota: Texto = ""


class ItemPago(Base):
    id: UUID
    obrero_id: UUID
    fechas: list[date] = Field(min_length=1, max_length=120)
    jornales: Annotated[float, Field(gt=0, le=1000)]
    jornal: Plata
    bruto: Plata
    plus: Plata = 0
    descuento: Plata = 0
    neto: Plata
    nota: Texto = ""


class PagoCrear(Base):
    id: UUID
    hasta: date
    fecha: date
    nota: Texto = ""
    items: list[ItemPago] = Field(min_length=1, max_length=500)


class HerramientaCrear(Base):
    id: UUID
    nombre: Nombre
    tipo: Literal["herramienta", "maquina"] = "herramienta"
    cantidad: Cantidad
    valor: Plata = 0
    nota: Texto = ""
    cuadrilla_id: UUID | None = None
    fecha: date


class HerramientaEditar(Base):
    id: UUID
    nombre: Nombre
    tipo: Literal["herramienta", "maquina"] = "herramienta"
    valor: Plata = 0
    nota: Texto = ""


class HerramientaCantidad(Base):
    id: UUID
    delta: Annotated[int, Field(ge=-100_000, le=100_000)]
    motivo: Texto = ""
    fecha: date

    @field_validator("delta")
    @classmethod
    def _no_cero(cls, v: int) -> int:
        if v == 0:
            raise ValueError("la cantidad no cambia")
        return v


class ItemMover(Base):
    herramienta_id: UUID
    cantidad: Cantidad


class HerramientaMover(Base):
    desde: UUID | None = None
    hacia: UUID | None = None
    items: list[ItemMover] = Field(min_length=1, max_length=300)
    nota: Texto = ""
    fecha: date

    @model_validator(mode="after")
    def _distintos(self):
        if self.desde == self.hacia:
            raise ValueError("el origen y el destino son el mismo lugar")
        return self


class Cargo(Base):
    adelanto_id: UUID
    obrero_id: UUID
    monto: Positivo


class HerramientaReclamo(Base):
    herramienta_id: UUID
    cuadrilla_id: UUID | None = None
    tipo: Literal["robo", "faltante", "rotura"]
    cantidad: Cantidad
    nota: Texto = ""
    fecha: date
    cargo: Cargo | None = None


class Login(Base):
    usuario: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
    clave: str = Field(min_length=1, max_length=200)


class CambioClave(Base):
    actual: str = Field(min_length=1, max_length=200)
    nueva: str = Field(min_length=6, max_length=200)


class Sincronizar(Base):
    cursor: int = Field(default=0, ge=0)
    ops: list[dict] = Field(default_factory=list, max_length=500)
