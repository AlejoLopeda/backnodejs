-- 20251101_create_audit_tables.sql
-- Crea entidades de auditoria para rastrear creacion/edicion/eliminacion.
BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_event_enum') THEN
    CREATE TYPE public.audit_event_enum AS ENUM ('CREAR', 'ACTUALIZAR', 'ELIMINAR');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.auditoria_eventos (
  id_evento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad VARCHAR(100) NOT NULL,
  registro_id VARCHAR(120) NOT NULL,
  accion public.audit_event_enum NOT NULL,
  usuario_id INTEGER NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  datos_previos JSONB,
  datos_nuevos JSONB,
  descripcion TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON public.auditoria_eventos (entidad);
CREATE INDEX IF NOT EXISTS idx_auditoria_registro ON public.auditoria_eventos (registro_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON public.auditoria_eventos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON public.auditoria_eventos (creado_en DESC);

COMMIT;
