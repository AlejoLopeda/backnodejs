-- Migra clientes: tipo_cliente -> tipo_tercero ('Cliente','Proveedor')
BEGIN;

-- Crear nuevo tipo si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'tipo_tercero_enum'
  ) THEN
    CREATE TYPE public.tipo_tercero_enum AS ENUM ('Cliente','Proveedor');
  END IF;
END $$;

-- Renombrar columna si existe y no existe la nueva
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'tipo_cliente'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'tipo_tercero'
  ) THEN
    ALTER TABLE public.clientes RENAME COLUMN tipo_cliente TO tipo_tercero;
  END IF;
END $$;

-- Convertir el tipo de la columna al nuevo ENUM (mapeando a 'Cliente' por defecto)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'tipo_tercero'
  ) THEN
    BEGIN
      ALTER TABLE public.clientes
      ALTER COLUMN tipo_tercero TYPE public.tipo_tercero_enum
      USING (
        CASE
          WHEN (tipo_tercero::text IN ('Cliente','Proveedor')) THEN (tipo_tercero::text)::public.tipo_tercero_enum
          ELSE 'Cliente'::public.tipo_tercero_enum
        END
      );
      ALTER TABLE public.clientes ALTER COLUMN tipo_tercero SET NOT NULL;
    EXCEPTION WHEN undefined_object THEN
      -- si la columna era TEXT o similar, reintentar con cast directo
      ALTER TABLE public.clientes
      ALTER COLUMN tipo_tercero TYPE public.tipo_tercero_enum
      USING (
        CASE
          WHEN (tipo_tercero IN ('Cliente','Proveedor')) THEN tipo_tercero::public.tipo_tercero_enum
          ELSE 'Cliente'::public.tipo_tercero_enum
        END
      );
      ALTER TABLE public.clientes ALTER COLUMN tipo_tercero SET NOT NULL;
    END;
  END IF;
END $$;

-- Intentar eliminar el viejo enum si no se usa
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_cliente_enum') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_attribute a ON a.atttypid = t.oid
      WHERE t.typname = 'tipo_cliente_enum' AND a.attisdropped = false
    ) THEN
      DROP TYPE public.tipo_cliente_enum;
    END IF;
  END IF;
END $$;

COMMIT;

