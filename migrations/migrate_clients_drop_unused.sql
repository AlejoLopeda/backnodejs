-- Elimina columnas en desuso del módulo de clientes y limpia tipos
BEGIN;

-- Quitar columnas si existen
ALTER TABLE public.clientes DROP COLUMN IF EXISTS direccion;
ALTER TABLE public.clientes DROP COLUMN IF EXISTS ciudad;
ALTER TABLE public.clientes DROP COLUMN IF EXISTS pais;
ALTER TABLE public.clientes DROP COLUMN IF EXISTS estado;
ALTER TABLE public.clientes DROP COLUMN IF EXISTS notas;

-- Intentar eliminar el enum de estado si ya no es usado por ninguna columna
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_cliente_enum') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_attribute a ON a.atttypid = t.oid
      WHERE t.typname = 'estado_cliente_enum' AND a.attisdropped = false
    ) THEN
      DROP TYPE public.estado_cliente_enum;
    END IF;
  END IF;
END $$;

COMMIT;

