const fs = require('fs');
const path = require('path');
const db = require('../db');

const MIGRATION_FILE = path.join(__dirname, '..', '..', 'migrations', 'migrate_products_up.sql');

async function ensureProductosSchema() {
  const checkQuery = `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'productos'
    ) AS existe;
  `;
  const { rows } = await db.query(checkQuery);
  if (rows[0]?.existe) return;
  const migrationSql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  await db.query(migrationSql);
}

async function countProducts(client) {
  const executor = client || { query: db.query };
  const { rows } = await executor.query('SELECT COUNT(*)::int AS c FROM public.productos');
  return rows[0].c;
}

async function ensureAnyProductExists(client) {
  const c = await countProducts(client);
  if (c === 0) {
    const error = new Error('No hay productos registrados');
    error.code = 'NO_PRODUCTS';
    throw error;
  }
}

async function subtractStockBulk(client, items) {
  for (const it of items) {
    const { rows } = await client.query(
      `UPDATE public.productos
       SET stock = stock - $2, fecha_actualizacion = NOW()
       WHERE id_producto = $1 AND stock >= $2
       RETURNING id_producto;`,
      [it.id_producto, it.cantidad]
    );
    if (!rows[0]) {
      const e = new Error(`Stock insuficiente o producto inexistente (id ${it.id_producto})`);
      e.code = 'STOCK_INSUFICIENTE';
      throw e;
    }
  }
}

async function addStockBulk(client, items) {
  for (const it of items) {
    await client.query(
      `UPDATE public.productos
       SET stock = stock + $2, fecha_actualizacion = NOW()
       WHERE id_producto = $1;`,
      [it.id_producto, it.cantidad]
    );
  }
}

module.exports = {
  ensureProductosSchema,
  ensureAnyProductExists,
  subtractStockBulk,
  addStockBulk,
};

