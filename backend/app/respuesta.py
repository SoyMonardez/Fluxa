from typing import Any

import orjson
from starlette.responses import Response


class Rapida(Response):
    """JSON con orjson (fechas y floats sin conversiones intermedias)."""

    media_type = "application/json"

    def render(self, content: Any) -> bytes:
        # asyncpg devuelve su propio tipo de UUID: se pasa a texto.
        return orjson.dumps(content, default=str)
