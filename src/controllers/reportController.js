const saleModel = require('../models/saleModel');
const purchaseModel = require('../models/purchaseModel');

function parseDateOnly(value, fieldName) {
  if (!value) {
    throw new Error(`${fieldName} es obligatorio`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} debe ser una fecha valida`);
  }

  return date;
}

function normalizeRange(desde, hasta) {
  const startDate = parseDateOnly(desde, 'desde');
  const endDate = parseDateOnly(hasta, 'hasta');

  if (endDate.getTime() < startDate.getTime()) {
    throw new Error('hasta debe ser mayor o igual que desde');
  }

  const startISO = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate())).toISOString();
  const endISO = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23, 59, 59, 999)).toISOString();

  return {
    startISO,
    endISO,
    startDateStr: startISO.slice(0, 10),
    endDateStr: endISO.slice(0, 10),
  };
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function groupTotalsByDay(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!row || !row.fecha) {
      return;
    }
    const dateKey = new Date(row.fecha).toISOString().slice(0, 10);
    const current = map.get(dateKey) || 0;
    map.set(dateKey, current + toNumber(row.total));
  });

  return Array.from(map.entries())
    .map(([fecha, total]) => ({ fecha, total: Number(total.toFixed(2)) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function aggregateTopProducts(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const items = Array.isArray(row?.items) ? row.items : [];
    items.forEach((item) => {
      if (!item) return;
      const productId = item.idProducto || item.id_producto || item.productId || item.id;
      if (!productId) return;
      const productName = item.productoNombre || item.nombre || item.productName || item.producto || null;
      const productRef = item.productoReferencia || item.referencia || item.sku || null;
      const key = String(productId);
      const prev =
        map.get(key) || { idProducto: productId, nombre: productName, referencia: productRef, cantidad: 0, total: 0 };
      if (!prev.nombre && productName) {
        prev.nombre = productName;
      }
      if (!prev.referencia && productRef) {
        prev.referencia = productRef;
      }
      const cantidad = toNumber(item.cantidad);
      const precioTotal = item.precioTotal ?? item.precio_total ?? (toNumber(item.precioUnitario ?? item.precio_unitario) * cantidad);
      prev.cantidad += cantidad;
      prev.total += toNumber(precioTotal);
      map.set(key, prev);
    });
  });

  return Array.from(map.values())
    .map((entry) => ({
      idProducto: entry.idProducto,
      nombre: (() => {
        const parts = [];
        if (entry.nombre) parts.push(entry.nombre);
        if (entry.referencia) parts.push(entry.referencia);
        if (!parts.length) {
          return `Producto ${entry.idProducto}`;
        }
        return parts.join(' — ');
      })(),
      nombreOriginal: entry.nombre || null,
      referencia: entry.referencia || null,
      cantidad: entry.cantidad,
      total: Number(entry.total.toFixed(2)),
    }))
    .sort((a, b) => b.cantidad - a.cantidad || b.total - a.total);
}

async function getSummary(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const { desde, hasta } = req.query || {};
    const { startISO, endISO, startDateStr, endDateStr } = normalizeRange(desde, hasta);

    const [sales, purchases] = await Promise.all([
      saleModel.getSalesByDateRange(userId, startISO, endISO),
      purchaseModel.getPurchasesByDateRange(userId, startISO, endISO),
    ]);

    const ventasTotal = sales.reduce((acc, row) => acc + toNumber(row.total), 0);
    const comprasTotal = purchases.reduce((acc, row) => acc + toNumber(row.total), 0);

    const payload = {
      rango: {
        desde: startDateStr,
        hasta: endDateStr,
      },
      ingresos: {
        total: Number(ventasTotal.toFixed(2)),
        cantidad: sales.length,
      },
      egresos: {
        total: Number(comprasTotal.toFixed(2)),
        cantidad: purchases.length,
      },
      resultadoNeto: Number((ventasTotal - comprasTotal).toFixed(2)),
      ventasPorDia: groupTotalsByDay(sales),
      comprasPorDia: groupTotalsByDay(purchases),
      topProductosVendidos: aggregateTopProducts(sales),
      topProductosComprados: aggregateTopProducts(purchases),
    };

    return res.status(200).json(payload);
  } catch (error) {
    if (error.message) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error al generar resumen de reportes:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  getSummary,
};
