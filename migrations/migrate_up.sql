-- migrate_up.sql
-- Crea el esquema de clientes, tipos enumerados y los indices asociados.
-- Verificacion sugerida: ejecutar el script en PostgreSQL y usar POST /clientes para crear registros.
BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE public.tipo_cliente_enum AS ENUM ('Natural', 'Juridica');
CREATE TYPE public.tipo_documento_enum AS ENUM ('NIT', 'CC', 'CE', 'RUC', 'DNI');
CREATE TYPE public.estado_cliente_enum AS ENUM ('Activo', 'Inactivo');

CREATE TABLE public.clientes (
  id_cliente UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_cliente public.tipo_cliente_enum NOT NULL,
  nombre_razon_social VARCHAR(200) NOT NULL,
  tipo_documento public.tipo_documento_enum NOT NULL,
  numero_documento VARCHAR(50) NOT NULL,
  correo_electronico VARCHAR(254) NOT NULL,
  telefono VARCHAR(30),
  direccion VARCHAR(200),
  ciudad VARCHAR(100),
  pais VARCHAR(100),
  estado public.estado_cliente_enum NOT NULL DEFAULT 'Activo',
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registrado_por VARCHAR(100),
  notas TEXT,
  CONSTRAINT uq_clientes_numero_documento UNIQUE (numero_documento),
  CONSTRAINT uq_clientes_correo_electronico UNIQUE (correo_electronico),
  CONSTRAINT chk_clientes_correo_electronico CHECK (correo_electronico ~* E'^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$')
);

COMMENT ON TABLE public.clientes IS 'Catalogo maestro de clientes para operaciones comerciales.';
COMMENT ON COLUMN public.clientes.id_cliente IS 'Identificador unico del cliente.';
COMMENT ON COLUMN public.clientes.tipo_cliente IS 'Clasificacion del cliente: persona Natural o Juridica.';
COMMENT ON COLUMN public.clientes.nombre_razon_social IS 'Nombre completo o razon social del cliente.';
COMMENT ON COLUMN public.clientes.tipo_documento IS 'Tipo de documento de identificacion del cliente.';
COMMENT ON COLUMN public.clientes.numero_documento IS 'Numero del documento de identificacion del cliente.';
COMMENT ON COLUMN public.clientes.correo_electronico IS 'Correo electronico principal del cliente.';
COMMENT ON COLUMN public.clientes.telefono IS 'Telefono principal del cliente.';
COMMENT ON COLUMN public.clientes.direccion IS 'Direccion fisica del cliente.';
COMMENT ON COLUMN public.clientes.ciudad IS 'Ciudad asociada a la direccion del cliente.';
COMMENT ON COLUMN public.clientes.pais IS 'Pais del cliente.';
COMMENT ON COLUMN public.clientes.estado IS 'Estado operativo del cliente (Activo o Inactivo).';
COMMENT ON COLUMN public.clientes.fecha_creacion IS 'Timestamp de creacion del registro.';
COMMENT ON COLUMN public.clientes.registrado_por IS 'Usuario o sistema que registro al cliente.';
COMMENT ON COLUMN public.clientes.notas IS 'Notas o comentarios adicionales sobre el cliente.';

CREATE INDEX idx_clientes_nombre ON public.clientes (nombre_razon_social);
CREATE INDEX idx_clientes_numero_documento ON public.clientes (numero_documento);
CREATE INDEX idx_clientes_correo_electronico ON public.clientes (correo_electronico);

COMMIT;
