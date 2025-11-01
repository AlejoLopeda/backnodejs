const fs = require('fs');
const path = require('path');
const db = require('../db');

const MIGRATION_FILE = path.join(__dirname, '..', '..', 'migrations', '20251101_create_productos.sql');

const INSERTABLE_FIELDS = ['referencia', 'categoria', 'precio', 'nombre', 'cantidad'];
const UPDATABLE_FIELDS = INSERTABLE_FIELDS;

async function ensureProductosSchema() {
  const checkQuery = `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'productos'
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

  if (!columns.length) {
    throw new Error('No hay datos para crear el producto');
  }

  const query = `
    INSERT INTO public.productos (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *;
  `;

  return { query, values };
}

function buildUpdateStatement(idProducto, data) {
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
    UPDATE public.productos
    SET ${setClauses.join(', ')}
    WHERE id_producto = $${index}
    RETURNING *;
  `;

  values.push(idProducto);

  return { query, values };
}

async function createProduct(data) {
  const { query, values } = buildInsertStatement(data);
  const result = await db.query(query, values);
  return result.rows[0];
}

async function getProductById(idProducto) {
  const query = `
    SELECT *
    FROM public.productos
    WHERE id_producto = $1;
  `;
  const result = await db.query(query, [idProducto]);
  return result.rows[0] || null;
}

async function updateProduct(idProducto, data) {
  const { query, values } = buildUpdateStatement(idProducto, data);
  const result = await db.query(query, values);
  return result.rows[0] || null;
}

async function deleteProduct(idProducto) {
  const query = `
    DELETE FROM public.productos
    WHERE id_producto = $1
    RETURNING id_producto;
  `;
  const result = await db.query(query, [idProducto]);
  return result.rows[0] || null;
}

module.exports = {
  ensureProductosSchema,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct,
};
