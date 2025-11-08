const fs = require('fs');
const path = require('path');
const db = require('../db');

const MIGRATION_FILE = path.join(__dirname, '..', '..', 'migrations', '20251101_create_audit_tables.sql');

async function ensureAuditoriaSchema() {
  const checkQuery = `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'auditoria_eventos'
    ) AS existe;
  `;

  const { rows } = await db.query(checkQuery);
  if (rows[0]?.existe) {
    return;
  }

  const migrationSql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  await db.query(migrationSql);
}

async function logEvent({ entidad, registroId, accion, usuarioId, datosPrevios = null, datosNuevos = null, descripcion = null }) {
  if (!entidad || !registroId || !accion) {
    throw new Error('entidad, registroId y accion son obligatorios para la auditoria');
  }

  const query = `
    INSERT INTO public.auditoria_eventos
      (entidad, registro_id, accion, usuario_id, datos_previos, datos_nuevos, descripcion)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
  `;

  const values = [
    entidad,
    String(registroId),
    accion,
    usuarioId || null,
    datosPrevios ? JSON.stringify(datosPrevios) : null,
    datosNuevos ? JSON.stringify(datosNuevos) : null,
    descripcion || null,
  ];

  await db.query(query, values);
}

module.exports = {
  ensureAuditoriaSchema,
  logEvent,
};
