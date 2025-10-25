const fs = require('fs');
const path = require('path');
const db = require('../db');

const MIGRATION_FILE = path.join(__dirname, '..', '..', 'migrations', 'migrate_up.sql');
const ALTER_TERCEROS_MIGRATION = path.join(
  __dirname,
  '..',
  '..',
  'migrations',
  'migrate_clients_alter_terceros.sql'
);
const DROP_UNUSED_COLUMNS_MIGRATION = path.join(
  __dirname,
  '..',
  '..',
  'migrations',
  'migrate_clients_drop_unused.sql'
);
const BACKUP_UNUSED_COLUMNS_MIGRATION = path.join(
  __dirname,
  '..',
  '..',
  'migrations',
  'migrate_clients_backup_unused.sql'
);

const INSERTABLE_FIELDS = [
  'id_cliente',
  'tipo_tercero',
  'nombre_razon_social',
  'tipo_documento',
  'numero_documento',
  'correo_electronico',
  'telefono',
  'fecha_creacion',
  'registrado_por',
];

const UPDATABLE_FIELDS = INSERTABLE_FIELDS.filter((field) => field !== 'id_cliente' && field !== 'fecha_creacion');

async function ensureClientesSchema() {
  const checkQuery = `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'clientes'
    ) AS existe;
  `;

  const { rows } = await db.query(checkQuery);
  if (!rows[0]?.existe) {
    const migrationSql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    await db.query(migrationSql);
  }

  // Ajuste de esquema: columna tipo_tercero y enum correspondiente
  const colQuery = `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'tipo_tercero'
    ) AS tiene;
  `;
  const chk = await db.query(colQuery);
  if (!chk.rows[0]?.tiene) {
    const alterSql = fs.readFileSync(ALTER_TERCEROS_MIGRATION, 'utf8');
    await db.query(alterSql);
  }

  // Retirar columnas ya no utilizadas si existen
  const colsToDrop = ['direccion','ciudad','pais','estado','notas'];
  const colsQuery = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clientes'
      AND column_name = ANY($1)
  `;
  const { rows: existingCols } = await db.query(colsQuery, [colsToDrop]);
  if (existingCols && existingCols.length) {
    // Primero respalda
    const backupSql = fs.readFileSync(BACKUP_UNUSED_COLUMNS_MIGRATION, 'utf8');
    await db.query(backupSql);
    // Luego elimina
    const dropSql = fs.readFileSync(DROP_UNUSED_COLUMNS_MIGRATION, 'utf8');
    await db.query(dropSql);
  }
}

function buildInsertStatement(data) {
  const columns = [];
  const placeholders = [];
  const values = [];
  let index = 1;

  INSERTABLE_FIELDS.forEach((field) => {
    if (data[field] !== undefined && data[field] !== null) {
      columns.push(field);
      placeholders.push(`$${index}`);
      values.push(data[field]);
      index += 1;
    }
  });

  const query = `
    INSERT INTO public.clientes (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *;
  `;

  return { query, values };
}

function buildUpdateStatement(idCliente, data) {
  const setClauses = [];
  const values = [];
  let index = 1;

  UPDATABLE_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      setClauses.push(`${field} = $${index}`);
      values.push(data[field]);
      index += 1;
    }
  });

  if (!setClauses.length) {
    throw new Error('No hay campos para actualizar');
  }

  const query = `
    UPDATE public.clientes
    SET ${setClauses.join(', ')}
    WHERE id_cliente = $${index}
    RETURNING *;
  `;

  values.push(idCliente);

  return { query, values };
}

async function createClient(data) {
  const { query, values } = buildInsertStatement(data);
  const result = await db.query(query, values);
  return result.rows[0];
}

async function getClients() {
  const query = `
    SELECT 
      id_cliente,
      tipo_tercero,
      nombre_razon_social,
      tipo_documento,
      numero_documento,
      correo_electronico,
      telefono,
      fecha_creacion,
      registrado_por
    FROM public.clientes
    ORDER BY nombre_razon_social ASC;
  `;
  const result = await db.query(query);
  return result.rows;
}

async function getClientById(idCliente) {
  const query = `
    SELECT 
      id_cliente,
      tipo_tercero,
      nombre_razon_social,
      tipo_documento,
      numero_documento,
      correo_electronico,
      telefono,
      fecha_creacion,
      registrado_por
    FROM public.clientes
    WHERE id_cliente = $1;
  `;
  const result = await db.query(query, [idCliente]);
  return result.rows[0] || null;
}

async function updateClient(idCliente, data) {
  const { query, values } = buildUpdateStatement(idCliente, data);
  const result = await db.query(query, values);
  return result.rows[0] || null;
}

async function deleteClient(idCliente) {
  const query = `
    DELETE FROM public.clientes
    WHERE id_cliente = $1
    RETURNING id_cliente;
  `;
  const result = await db.query(query, [idCliente]);
  return result.rows[0] || null;
}

module.exports = {
  ensureClientesSchema,
  createClient,
  getClients,
  getClientById,
  updateClient,
  deleteClient,
};
