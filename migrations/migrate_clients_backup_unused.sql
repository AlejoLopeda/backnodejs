-- Respaldo temporal de columnas obsoletas en clientes
BEGIN;

CREATE TABLE IF NOT EXISTS public.clientes_archivo (
  id_cliente UUID NOT NULL,
  direccion VARCHAR(200),
  ciudad VARCHAR(100),
  pais VARCHAR(100),
  estado TEXT,
  notas TEXT,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Copia los datos actuales sólo si aún no fueron archivados para ese id_cliente
INSERT INTO public.clientes_archivo (id_cliente, direccion, ciudad, pais, estado, notas)
SELECT c.id_cliente, c.direccion, c.ciudad, c.pais, c.estado::text, c.notas
FROM public.clientes c
LEFT JOIN public.clientes_archivo a ON a.id_cliente = c.id_cliente
WHERE a.id_cliente IS NULL;

COMMIT;

