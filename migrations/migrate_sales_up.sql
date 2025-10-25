-- migrate_sales_up.sql
-- Esquema de ventas y detalle de items.
BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.ventas (
  id_venta UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cliente UUID NULL REFERENCES public.clientes(id_cliente) ON UPDATE CASCADE ON DELETE SET NULL,
  id_usuario INTEGER NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metodo_pago VARCHAR(50),
  total NUMERIC(12,2) NOT NULL CHECK (total >= 0)
);

CREATE TABLE IF NOT EXISTS public.ventas_items (
  id_item UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_venta UUID NOT NULL REFERENCES public.ventas(id_venta) ON UPDATE CASCADE ON DELETE CASCADE,
  id_producto INTEGER NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  precio_total NUMERIC(12,2) NOT NULL CHECK (precio_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ventas_usuario_fecha ON public.ventas (id_usuario, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_items_venta ON public.ventas_items (id_venta);

COMMIT;

