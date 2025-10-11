-- migrate_down.sql
-- Revierte el esquema de clientes eliminando indices, tabla y tipos enumerados.
BEGIN;

DROP INDEX IF EXISTS idx_clientes_correo_electronico;
DROP INDEX IF EXISTS idx_clientes_numero_documento;
DROP INDEX IF EXISTS idx_clientes_nombre;

DROP TABLE IF EXISTS public.clientes;

DROP TYPE IF EXISTS public.estado_cliente_enum;
DROP TYPE IF EXISTS public.tipo_documento_enum;
DROP TYPE IF EXISTS public.tipo_cliente_enum;

DROP EXTENSION IF EXISTS "pgcrypto";

COMMIT;
