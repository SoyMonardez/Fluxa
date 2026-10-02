-- Esquema de Fluxa / ETEM (idempotente: se aplica en cada arranque).
--
-- Los ids los genera el celular (UUID) para poder crear cosas sin señal.
-- Cada tabla sincronizable tiene "rev": un número global que crece en cada alta o
-- cambio. El celular pide "lo que cambió después de N". No se borra nada: las bajas
-- son marcas (jornales 0, anulado, activo = false, stock 0) para que también viajen.

CREATE SEQUENCE IF NOT EXISTS rev_seq;

CREATE OR REPLACE FUNCTION tocar_rev() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.rev := nextval('rev_seq');
  RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  usuario TEXT NOT NULL UNIQUE,
  clave_hash TEXT NOT NULL,
  creado TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cuadrillas (
  id UUID PRIMARY KEY,
  nombre TEXT NOT NULL,
  obra TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'naranja',
  encargado_id UUID,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  rev BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS obreros (
  id UUID PRIMARY KEY,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'Ayudante',
  jornal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (jornal >= 0),
  telefono TEXT NOT NULL DEFAULT '',
  nota TEXT NOT NULL DEFAULT '',
  cuadrilla_id UUID REFERENCES cuadrillas(id),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  rev BIGINT NOT NULL DEFAULT 0
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cuadrillas_encargado_fk') THEN
    ALTER TABLE cuadrillas ADD CONSTRAINT cuadrillas_encargado_fk FOREIGN KEY (encargado_id) REFERENCES obreros(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY,
  hasta DATE NOT NULL,
  fecha DATE NOT NULL,
  total_bruto NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_plus NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_descuentos NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_neto NUMERIC(14,2) NOT NULL DEFAULT 0,
  nota TEXT NOT NULL DEFAULT '',
  anulado BOOLEAN NOT NULL DEFAULT FALSE,
  creado TIMESTAMPTZ NOT NULL DEFAULT now(),
  rev BIGINT NOT NULL DEFAULT 0
);

-- Asistencia general: una fila por obrero y día. jornales 0 = falta.
CREATE TABLE IF NOT EXISTS asistencias (
  obrero_id UUID NOT NULL REFERENCES obreros(id),
  fecha DATE NOT NULL,
  jornales NUMERIC(3,1) NOT NULL CHECK (jornales IN (0, 0.5, 1, 1.5, 2)),
  nota TEXT NOT NULL DEFAULT '',
  pago_id UUID REFERENCES pagos(id),
  rev BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (obrero_id, fecha)
);

CREATE TABLE IF NOT EXISTS adelantos (
  id UUID PRIMARY KEY,
  obrero_id UUID NOT NULL REFERENCES obreros(id),
  tipo TEXT NOT NULL DEFAULT 'adelanto' CHECK (tipo IN ('adelanto', 'cargo')),
  monto NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  fecha DATE NOT NULL,
  nota TEXT NOT NULL DEFAULT '',
  movimiento_id UUID,
  anulado BOOLEAN NOT NULL DEFAULT FALSE,
  creado TIMESTAMPTZ NOT NULL DEFAULT now(),
  rev BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pago_items (
  id UUID PRIMARY KEY,
  pago_id UUID NOT NULL REFERENCES pagos(id),
  obrero_id UUID NOT NULL REFERENCES obreros(id),
  fechas DATE[] NOT NULL,
  dias INT NOT NULL,
  jornales NUMERIC(7,1) NOT NULL,
  jornal NUMERIC(14,2) NOT NULL,
  bruto NUMERIC(14,2) NOT NULL,
  plus NUMERIC(14,2) NOT NULL DEFAULT 0,
  descuento NUMERIC(14,2) NOT NULL DEFAULT 0,
  neto NUMERIC(14,2) NOT NULL,
  nota TEXT NOT NULL DEFAULT '',
  rev BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS herramientas (
  id UUID PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'herramienta' CHECK (tipo IN ('herramienta', 'maquina')),
  cantidad INT NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  valor NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  nota TEXT NOT NULL DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  rev BIGINT NOT NULL DEFAULT 0
);

-- Lo que tiene cada cuadrilla. Pañol = total − Σ stock.
CREATE TABLE IF NOT EXISTS herramienta_stock (
  herramienta_id UUID NOT NULL REFERENCES herramientas(id),
  cuadrilla_id UUID NOT NULL REFERENCES cuadrillas(id),
  cantidad INT NOT NULL CHECK (cantidad >= 0),
  rev BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (herramienta_id, cuadrilla_id)
);

CREATE TABLE IF NOT EXISTS movimientos (
  id UUID PRIMARY KEY,
  herramienta_id UUID NOT NULL REFERENCES herramientas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('alta', 'ajuste', 'entrega', 'devolucion', 'traslado', 'robo', 'faltante', 'rotura')),
  cantidad INT NOT NULL,
  desde_id UUID REFERENCES cuadrillas(id),
  hacia_id UUID REFERENCES cuadrillas(id),
  responsable_id UUID REFERENCES obreros(id),
  cargo NUMERIC(14,2) NOT NULL DEFAULT 0,
  nota TEXT NOT NULL DEFAULT '',
  fecha DATE NOT NULL,
  creado TIMESTAMPTZ NOT NULL DEFAULT now(),
  rev BIGINT NOT NULL DEFAULT 0
);

-- Operaciones ya aplicadas: si el celular reintenta, no se repiten.
CREATE TABLE IF NOT EXISTS ops_aplicadas (
  id UUID PRIMARY KEY,
  tipo TEXT NOT NULL,
  ok BOOLEAN NOT NULL,
  error TEXT,
  usuario_id INT,
  aplicada TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['cuadrillas', 'obreros', 'pagos', 'asistencias', 'adelantos', 'pago_items',
                           'herramientas', 'herramienta_stock', 'movimientos'] LOOP
    EXECUTE format('CREATE OR REPLACE TRIGGER %I BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION tocar_rev()', t || '_rev', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (rev)', t || '_rev_idx', t);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS asistencias_fecha_idx ON asistencias (fecha);
CREATE INDEX IF NOT EXISTS asistencias_pago_idx ON asistencias (pago_id);
CREATE INDEX IF NOT EXISTS adelantos_obrero_idx ON adelantos (obrero_id);
CREATE INDEX IF NOT EXISTS pago_items_pago_idx ON pago_items (pago_id);
CREATE INDEX IF NOT EXISTS pago_items_obrero_idx ON pago_items (obrero_id);
CREATE INDEX IF NOT EXISTS stock_cuadrilla_idx ON herramienta_stock (cuadrilla_id);
CREATE INDEX IF NOT EXISTS movimientos_herramienta_idx ON movimientos (herramienta_id);
CREATE INDEX IF NOT EXISTS ops_aplicadas_fecha_idx ON ops_aplicadas (aplicada);
