const fs = require('fs');
const path = require('path');
const db = require('../db');

const MIGRATION_FILE = path.join(__dirname, '..', '..', 'migrations', 'migrate_up.sql');

const INSERTABLE_FIELDS = [
  'id_cliente',
  'tipo_cliente',
  'nombre_razon_social',
  'tipo_documento',
  'numero_documento',
  'correo_electronico',
  'telefono',
  'direccion',
  'ciudad',
  'pais',
  'estado',
  'fecha_creacion',
  'registrado_por',
  'notas',
];

const UPDATABLE_FIELDS = INSERTABLE_FIELDS.filter(
  (field) => field !== 'id_cliente' && field !== 'fecha_creacion'
);

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
  if (rows[0]?.existe) {
    return;
  }

  const migrationSql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  await db.query(migrationSql);
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
    SELECT *
    FROM public.clientes
    ORDER BY nombre_razon_social ASC;
  `;
  const result = await db.query(query);
  return result.rows;
}

async function getClientById(idCliente) {
  const query = `
    SELECT *
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
