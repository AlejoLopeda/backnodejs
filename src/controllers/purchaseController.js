const purchaseModel = require('../models/purchaseModel');

// Mapeo camelCase -> snake_case para el encabezado de compra
const FIELD_MAP = {
  idCompra: 'id_compra',
  idProveedor: 'id_proveedor',
  fecha: 'fecha',
  metodoPago: 'metodo_pago',
  notas: 'notas',
};

function validarItems(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error('items es obligatorio y debe ser un arreglo con al menos un elemento');
  }

  for (const [i, it] of items.entries()) {
    if (it == null || typeof it !== 'object') {
      throw new Error(`items[${i}] debe ser un objeto`);
    }
    const { productId, quantity, unitPrice } = it;
    if (productId === undefined || productId === null) {
      throw new Error(`items[${i}].productId es obligatorio`);
    }
    if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0 || !Number.isInteger(Number(quantity))) {
      throw new Error(`items[${i}].quantity debe ser un entero > 0`);
    }
    if (!Number.isFinite(Number(unitPrice)) || Number(unitPrice) < 0) {
      throw new Error(`items[${i}].unitPrice debe ser un numero >= 0`);
    }
  }
}

function mapHeaderToColumns(payload) {
  const mapped = {};
  Object.entries(FIELD_MAP).forEach(([inKey, col]) => {
    if (Object.prototype.hasOwnProperty.call(payload, inKey)) {
      const val = payload[inKey];
      if (val === '') return;
      mapped[col] = val == null ? null : val;
    }
  });
  return mapped;
}

function mapItemsToColumns(items) {
  return items.map((it) => ({
    id_producto: it.productId,
    cantidad: Number(it.quantity),
    precio_unitario: Number(Number(it.unitPrice).toFixed(2)),
  }));
}

async function createPurchase(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Usuario no autenticado' });

    const payload = req.body || {};
    validarItems(payload.items);

    const header = mapHeaderToColumns(payload);
    const items = mapItemsToColumns(payload.items);

    const created = await purchaseModel.createPurchase({
      id_proveedor: header.id_proveedor || null,
      id_usuario: userId,
      fecha: header.fecha,
      metodo_pago: header.metodo_pago,
      notas: header.notas,
      items,
    });

    return res.status(201).json(created);
  } catch (error) {
    if (error.message) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error al crear compra:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function listPurchases(req, res) {
  try {
    const userId = req.user?.id;
    const rows = await purchaseModel.getPurchases(userId);
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Error al listar compras:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getPurchase(req, res) {
  try {
    const userId = req.user?.id;
    const { idCompra } = req.params;
    const compra = await purchaseModel.getPurchaseById(idCompra, userId);
    if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });
    return res.status(200).json(compra);
  } catch (error) {
    console.error('Error al obtener compra:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function updatePurchase(req, res) {
  try {
    const userId = req.user?.id;
    const { idCompra } = req.params;
    const payload = req.body || {};

    if (payload.items !== undefined) {
      validarItems(payload.items);
    }

    const header = mapHeaderToColumns(payload);
    const items = Array.isArray(payload.items) ? mapItemsToColumns(payload.items) : undefined;

    const updated = await purchaseModel.updatePurchase(idCompra, userId, {
      id_proveedor: header.id_proveedor,
      fecha: header.fecha,
      metodo_pago: header.metodo_pago,
      notas: header.notas,
      items,
    });

    if (!updated) return res.status(404).json({ error: 'Compra no encontrada' });
    return res.status(200).json(updated);
  } catch (error) {
    if (error.message) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error al actualizar compra:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function deletePurchase(req, res) {
  try {
    const userId = req.user?.id;
    const { idCompra } = req.params;
    const deleted = await purchaseModel.deletePurchase(idCompra, userId);
    if (!deleted) return res.status(404).json({ error: 'Compra no encontrada' });
    return res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar compra:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  createPurchase,
  listPurchases,
  getPurchase,
  updatePurchase,
  deletePurchase,
};

