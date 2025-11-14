const fs = require('fs');
const path = require('path');
const db = require('../db');

const MIGRATION_FILE = path.join(__dirname, '..', '..', 'migrations', 'migrate_sales_up.sql');

async function ensureVentasSchema() {
  const checkQuery = `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'ventas'
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

async function createSale({ id_cliente, id_usuario, fecha, metodo_pago, items }) {
  await db.query('BEGIN');
  try {
    const { total, itemsConTotales } = calcularTotales(items);

    const insertVenta = `
      INSERT INTO public.ventas (id_cliente, id_usuario, fecha, metodo_pago, total)
      VALUES ($1, $2, COALESCE($3, NOW()), $4, $5)
      RETURNING *;
    `;
    const ventaRes = await db.query(insertVenta, [id_cliente || null, id_usuario, fecha || null, metodo_pago || null, total]);
    const venta = ventaRes.rows[0];

    const insertItem = `
      INSERT INTO public.ventas_items (id_venta, id_producto, cantidad, precio_unitario, precio_total)
      VALUES ($1, $2, $3, $4, $5);
    `;

    for (const it of itemsConTotales) {
      await db.query(insertItem, [venta.id_venta, it.id_producto, it.cantidad, it.precio_unitario, it.precio_total]);
    }

    await db.query('COMMIT');
    return await getSaleById(venta.id_venta, id_usuario);
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function getSaleById(id_venta, id_usuario) {
  const query = `
    SELECT v.*,
           COALESCE(json_agg(
             json_build_object(
               'idItem', vi.id_item,
               'idProducto', vi.id_producto,
               'cantidad', vi.cantidad,
               'precioUnitario', vi.precio_unitario,
               'precioTotal', vi.precio_total,
               'productoNombre', p.nombre,
               'productoReferencia', p.referencia
             )
           ) FILTER (WHERE vi.id_item IS NOT NULL), '[]') AS items
    FROM public.ventas v
    LEFT JOIN public.ventas_items vi ON vi.id_venta = v.id_venta
    LEFT JOIN public.productos p ON p.id_producto::text = vi.id_producto::text
    WHERE v.id_venta = $1 AND v.id_usuario = $2
    GROUP BY v.id_venta;
  `;
  const { rows } = await db.query(query, [id_venta, id_usuario]);
  return rows[0] || null;
}

async function getSales(id_usuario) {
  const query = `
    SELECT v.*,
           COALESCE(json_agg(
             json_build_object(
               'idItem', vi.id_item,
               'idProducto', vi.id_producto,
               'cantidad', vi.cantidad,
               'precioUnitario', vi.precio_unitario,
               'precioTotal', vi.precio_total,
               'productoNombre', p.nombre,
               'productoReferencia', p.referencia
             )
           ) FILTER (WHERE vi.id_item IS NOT NULL), '[]') AS items
    FROM public.ventas v
    LEFT JOIN public.ventas_items vi ON vi.id_venta = v.id_venta
    LEFT JOIN public.productos p ON p.id_producto::text = vi.id_producto::text
    WHERE v.id_usuario = $1
    GROUP BY v.id_venta
    ORDER BY v.fecha DESC, v.id_venta DESC;
  `;
  const { rows } = await db.query(query, [id_usuario]);
  return rows;
}

async function getSalesByDateRange(id_usuario, fechaInicio, fechaFin) {
  const query = `
    SELECT v.*,
           COALESCE(json_agg(
             json_build_object(
               'idItem', vi.id_item,
               'idProducto', vi.id_producto,
               'cantidad', vi.cantidad,
               'precioUnitario', vi.precio_unitario,
               'precioTotal', vi.precio_total,
               'productoNombre', p.nombre,
               'productoReferencia', p.referencia
             )
           ) FILTER (WHERE vi.id_item IS NOT NULL), '[]') AS items
    FROM public.ventas v
    LEFT JOIN public.ventas_items vi ON vi.id_venta = v.id_venta
    LEFT JOIN public.productos p ON p.id_producto::text = vi.id_producto::text
    WHERE v.id_usuario = $1
      AND v.fecha >= $2
      AND v.fecha <= $3
    GROUP BY v.id_venta
    ORDER BY v.fecha DESC, v.id_venta DESC;
  `;
  const { rows } = await db.query(query, [id_usuario, fechaInicio, fechaFin]);
  return rows;
}

async function updateSale(id_venta, id_usuario, { id_cliente, fecha, metodo_pago, items }) {
  await db.query('BEGIN');
  try {
    // Recalcular total si hay items
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
    if (id_cliente !== undefined) { sets.push(`id_cliente = $${idx++}`); values.push(id_cliente || null); }
    if (fecha !== undefined) { sets.push(`fecha = COALESCE($${idx++}, fecha)`); values.push(fecha || null); }
    if (metodo_pago !== undefined) { sets.push(`metodo_pago = $${idx++}`); values.push(metodo_pago || null); }
    if (total !== null) { sets.push(`total = $${idx++}`); values.push(total); }

    if (!sets.length && !Array.isArray(items)) {
      await db.query('ROLLBACK');
      throw new Error('No hay campos para actualizar');
    }

    if (sets.length) {
      const updateVenta = `
        UPDATE public.ventas
        SET ${sets.join(', ')}
        WHERE id_venta = $${idx} AND id_usuario = $${idx + 1}
        RETURNING id_venta;
      `;
      values.push(id_venta, id_usuario);
      const resUp = await db.query(updateVenta, values);
      if (!resUp.rows[0]) {
        await db.query('ROLLBACK');
        return null;
      }
    } else {
      // comprobar pertenencia
      const check = await db.query('SELECT 1 FROM public.ventas WHERE id_venta = $1 AND id_usuario = $2', [id_venta, id_usuario]);
      if (!check.rows[0]) { await db.query('ROLLBACK'); return null; }
    }

    if (Array.isArray(items)) {
      await db.query('DELETE FROM public.ventas_items WHERE id_venta = $1', [id_venta]);
      const insertItem = `
        INSERT INTO public.ventas_items (id_venta, id_producto, cantidad, precio_unitario, precio_total)
        VALUES ($1, $2, $3, $4, $5);
      `;
      for (const it of itemsConTotales) {
        await db.query(insertItem, [id_venta, it.id_producto, it.cantidad, it.precio_unitario, it.precio_total]);
      }
    }

    await db.query('COMMIT');
    return await getSaleById(id_venta, id_usuario);
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function deleteSale(id_venta, id_usuario) {
  const query = `
    DELETE FROM public.ventas
    WHERE id_venta = $1 AND id_usuario = $2
    RETURNING id_venta;
  `;
  const { rows } = await db.query(query, [id_venta, id_usuario]);
  return rows[0] || null;
}

module.exports = {
  ensureVentasSchema,
  createSale,
  getSales,
  getSalesByDateRange,
  getSaleById,
  updateSale,
  deleteSale,
};
