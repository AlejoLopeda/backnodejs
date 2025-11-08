-- migrate_purchases_up.sql
-- Esquema de compras y detalle de items.
BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.compras (
  id_compra UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_proveedor UUID NULL REFERENCES public.clientes(id_cliente) ON UPDATE CASCADE ON DELETE SET NULL,
  id_usuario INTEGER NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metodo_pago VARCHAR(50),
  notas TEXT NULL,
  total NUMERIC(12,2) NOT NULL CHECK (total >= 0)
);

CREATE TABLE IF NOT EXISTS public.compras_items (
  id_item UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_compra UUID NOT NULL REFERENCES public.compras(id_compra) ON UPDATE CASCADE ON DELETE CASCADE,
  id_producto INTEGER NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  precio_total NUMERIC(12,2) NOT NULL CHECK (precio_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_compras_usuario_fecha ON public.compras (id_usuario, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_compras_items_compra ON public.compras_items (id_compra);

COMMIT;

