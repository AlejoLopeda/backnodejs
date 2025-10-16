-- Elimina columnas no esenciales de la tabla clientes.
-- Ejecutar manualmente en la base de datos destino.

BEGIN;

ALTER TABLE public.clientes
  DROP COLUMN IF EXISTS condicion_pago,
  DROP COLUMN IF EXISTS limite_credito,
  DROP COLUMN IF EXISTS saldo_actual,
  DROP COLUMN IF EXISTS vendedor_asignado,
  DROP COLUMN IF EXISTS contacto_principal,
  DROP COLUMN IF EXISTS cargo_contacto,
  DROP COLUMN IF EXISTS telefono_contacto,
  DROP COLUMN IF EXISTS correo_contacto;

COMMIT;
