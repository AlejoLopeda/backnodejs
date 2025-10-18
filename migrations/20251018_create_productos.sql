-- 20251018_create_productos.sql
-- Crea la tabla productos y sus artefactos asociados.
BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE public.productos (
  id_producto UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia VARCHAR(100) NOT NULL UNIQUE,
  categoria VARCHAR(100) NOT NULL,
  precio NUMERIC(12, 2) NOT NULL CHECK (precio >= 0),
  nombre VARCHAR(200) NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad >= 0),
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.productos IS 'Catalogo de productos disponibles para la venta.';
COMMENT ON COLUMN public.productos.id_producto IS 'Identificador unico del producto.';
COMMENT ON COLUMN public.productos.referencia IS 'Codigo de referencia unico del producto.';
COMMENT ON COLUMN public.productos.categoria IS 'Categoria o familia a la que pertenece el producto.';
COMMENT ON COLUMN public.productos.precio IS 'Precio unitario del producto.';
COMMENT ON COLUMN public.productos.nombre IS 'Nombre descriptivo del producto.';
COMMENT ON COLUMN public.productos.cantidad IS 'Cantidad disponible en inventario.';
COMMENT ON COLUMN public.productos.fecha_creacion IS 'Marca temporal de creacion del registro.';
COMMENT ON COLUMN public.productos.fecha_actualizacion IS 'Marca temporal de la ultima actualizacion del registro.';

CREATE INDEX idx_productos_nombre ON public.productos (nombre);
CREATE INDEX idx_productos_categoria ON public.productos (categoria);
CREATE INDEX idx_productos_referencia ON public.productos (referencia);

CREATE OR REPLACE FUNCTION public.trigger_productos_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_actualizacion = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_productos_actualizacion
BEFORE UPDATE ON public.productos
FOR EACH ROW
EXECUTE FUNCTION public.trigger_productos_actualizacion();

COMMIT;
