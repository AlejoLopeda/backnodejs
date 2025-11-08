const fs = require('fs');
const path = require('path');
const db = require('../db');

const MIGRATION_FILE = path.join(__dirname, '..', '..', 'migrations', 'migrate_purchases_up.sql');

async function ensureComprasSchema() {
  const checkQuery = `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'compras'
    ) AS existe;
  `;

  const { rows } = await db.query(checkQuery);
  if (rows[0]?.existe) return;

  const migrationSql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  await db.query(migrationSql);
}

function calcularTotales(items) {
  let total = 0;
  const itemsConTotales = items.map((it) => {
    const precioTotal = Number((Number(it.precio_unitario) * Number(it.cantidad)).toFixed(2));
    total += precioTotal;
    return { ...it, precio_total: precioTotal };
  });
  total = Number(total.toFixed(2));
  return { total, itemsConTotales };
}

async function createPurchase({ id_proveedor, id_usuario, fecha, metodo_pago, notas, items }) {
  await db.query('BEGIN');
  try {
    const { total, itemsConTotales } = calcularTotales(items);

    const insertCompra = `
      INSERT INTO public.compras (id_proveedor, id_usuario, fecha, metodo_pago, notas, total)
      VALUES ($1, $2, COALESCE($3, NOW()), $4, $5, $6)
      RETURNING *;
    `;
    const compraRes = await db.query(insertCompra, [id_proveedor || null, id_usuario, fecha || null, metodo_pago || null, notas || null, total]);
    const compra = compraRes.rows[0];

    const insertItem = `
      INSERT INTO public.compras_items (id_compra, id_producto, cantidad, precio_unitario, precio_total)
      VALUES ($1, $2, $3, $4, $5);
    `;

    for (const it of itemsConTotales) {
      await db.query(insertItem, [compra.id_compra, it.id_producto, it.cantidad, it.precio_unitario, it.precio_total]);
    }

    await db.query('COMMIT');
    return await getPurchaseById(compra.id_compra, id_usuario);
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function getPurchaseById(id_compra, id_usuario) {
  const query = `
    SELECT c.*,
           COALESCE(json_agg(
             json_build_object(
               'idItem', ci.id_item,
               'idProducto', ci.id_producto,
               'cantidad', ci.cantidad,
               'precioUnitario', ci.precio_unitario,
               'precioTotal', ci.precio_total
             )
           ) FILTER (WHERE ci.id_item IS NOT NULL), '[]') AS items
    FROM public.compras c
    LEFT JOIN public.compras_items ci ON ci.id_compra = c.id_compra
    WHERE c.id_compra = $1 AND c.id_usuario = $2
    GROUP BY c.id_compra;
  `;
  const { rows } = await db.query(query, [id_compra, id_usuario]);
  return rows[0] || null;
}

async function getPurchases(id_usuario) {
  const query = `
    SELECT c.*,
           COALESCE(json_agg(
             json_build_object(
               'idItem', ci.id_item,
               'idProducto', ci.id_producto,
               'cantidad', ci.cantidad,
               'precioUnitario', ci.precio_unitario,
               'precioTotal', ci.precio_total
             )
           ) FILTER (WHERE ci.id_item IS NOT NULL), '[]') AS items
    FROM public.compras c
    LEFT JOIN public.compras_items ci ON ci.id_compra = c.id_compra
    WHERE c.id_usuario = $1
    GROUP BY c.id_compra
    ORDER BY c.fecha DESC, c.id_compra DESC;
  `;
  const { rows } = await db.query(query, [id_usuario]);
  return rows;
}

async function updatePurchase(id_compra, id_usuario, { id_proveedor, fecha, metodo_pago, notas, items }) {
  await db.query('BEGIN');
  try {
    let total = null;
    let itemsConTotales = null;
    if (Array.isArray(items)) {
      const calc = calcularTotales(items.map((i) => ({
        id_producto: i.id_producto,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      })));
      total = calc.total;
      itemsConTotales = calc.itemsConTotales;
    }

    const sets = [];
    const values = [];
    let idx = 1;
    if (id_proveedor !== undefined) { sets.push(`id_proveedor = $${idx++}`); values.push(id_proveedor || null); }
    if (fecha !== undefined) { sets.push(`fecha = COALESCE($${idx++}, fecha)`); values.push(fecha || null); }
    if (metodo_pago !== undefined) { sets.push(`metodo_pago = $${idx++}`); values.push(metodo_pago || null); }
    if (notas !== undefined) { sets.push(`notas = $${idx++}`); values.push(notas || null); }
    if (total !== null) { sets.push(`total = $${idx++}`); values.push(total); }

    if (!sets.length && !Array.isArray(items)) {
      await db.query('ROLLBACK');
      throw new Error('No hay campos para actualizar');
    }

    if (sets.length) {
      const updateCompra = `
        UPDATE public.compras
        SET ${sets.join(', ')}
        WHERE id_compra = $${idx} AND id_usuario = $${idx + 1}
        RETURNING id_compra;
      `;
      values.push(id_compra, id_usuario);
      const resUp = await db.query(updateCompra, values);
      if (!resUp.rows[0]) {
        await db.query('ROLLBACK');
        return null;
      }
    } else {
      const check = await db.query('SELECT 1 FROM public.compras WHERE id_compra = $1 AND id_usuario = $2', [id_compra, id_usuario]);
      if (!check.rows[0]) { await db.query('ROLLBACK'); return null; }
    }

    if (Array.isArray(items)) {
      await db.query('DELETE FROM public.compras_items WHERE id_compra = $1', [id_compra]);
      const insertItem = `
        INSERT INTO public.compras_items (id_compra, id_producto, cantidad, precio_unitario, precio_total)
        VALUES ($1, $2, $3, $4, $5);
      `;
      for (const it of itemsConTotales) {
        await db.query(insertItem, [id_compra, it.id_producto, it.cantidad, it.precio_unitario, it.precio_total]);
      }
    }

    await db.query('COMMIT');
    return await getPurchaseById(id_compra, id_usuario);
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function deletePurchase(id_compra, id_usuario) {
  const query = `
    DELETE FROM public.compras
    WHERE id_compra = $1 AND id_usuario = $2
    RETURNING id_compra;
  `;
  const { rows } = await db.query(query, [id_compra, id_usuario]);
  return rows[0] || null;
}

module.exports = {
  ensureComprasSchema,
  createPurchase,
  getPurchases,
  getPurchaseById,
  updatePurchase,
  deletePurchase,
};

