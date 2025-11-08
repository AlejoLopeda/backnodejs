const purchaseModel = require('../models/purchaseModel');
const auditModel = require('../models/auditModel');

// Límites y utilidades de validación
const LIMITS = {
  maxItems: 100,
  maxNotesLength: 1000,
  maxQuantity: 100000,
  maxUnitPrice: 100000000, // 1e8
  maxMetodoPagoLength: 50,
};

function isPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0;
}

function isNonNegativeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

function validateFecha(fecha) {
  if (fecha === undefined) return;
  if (fecha === null || fecha === '') return; // se permite null y vacía (se usa NOW())
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) {
    throw new Error('fecha debe ser una fecha válida');
  }
}

function validateHeader(payload) {
  if (payload.idProveedor !== undefined && payload.idProveedor !== null) {
    if (!isPositiveInt(payload.idProveedor)) {
      throw new Error('idProveedor debe ser un entero positivo');
    }
  }
  if (payload.metodoPago !== undefined && payload.metodoPago !== null) {
    if (typeof payload.metodoPago !== 'string') {
      throw new Error('metodoPago debe ser texto');
    }
    if (payload.metodoPago.length > LIMITS.maxMetodoPagoLength) {
      throw new Error(`metodoPago no debe exceder ${LIMITS.maxMetodoPagoLength} caracteres`);
    }
  }
  if (payload.notas !== undefined && payload.notas !== null) {
    if (typeof payload.notas !== 'string') {
      throw new Error('notas debe ser texto');
    }
    if (payload.notas.length > LIMITS.maxNotesLength) {
      throw new Error(`notas no debe exceder ${LIMITS.maxNotesLength} caracteres`);
    }
  }
  validateFecha(payload.fecha);
}

function validateItemsLimits(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error('items es obligatorio y debe ser un arreglo con al menos un elemento');
  }
  if (items.length > LIMITS.maxItems) {
    throw new Error(`items no debe tener más de ${LIMITS.maxItems} elementos`);
  }
}

function mapAndValidateItems(items) {
  validateItemsLimits(items);
  return items.map((it, i) => {
    if (it == null || typeof it !== 'object') {
      throw new Error(`items[${i}] debe ser un objeto`);
    }
    const { productId, quantity, unitPrice } = it;
    if (!isPositiveInt(productId)) {
      throw new Error(`items[${i}].productId debe ser un entero positivo`);
    }
    if (!isPositiveInt(quantity)) {
      throw new Error(`items[${i}].quantity debe ser un entero > 0`);
    }
    if (!isNonNegativeNumber(unitPrice) || Number(unitPrice) > LIMITS.maxUnitPrice) {
      throw new Error(`items[${i}].unitPrice debe ser un número entre 0 y ${LIMITS.maxUnitPrice}`);
    }
    return {
      id_producto: Number(productId),
      cantidad: Number(quantity),
      precio_unitario: Number(Number(unitPrice).toFixed(2)),
    };
  });
}

function handleDbError(error, res) {
  // Código PGError: https://www.postgresql.org/docs/current/errcodes-appendix.html
  if (!error || !error.code) return null;
  if (error.code === '23503') {
    const detail = (error.detail || '').toLowerCase();
    if (detail.includes('id_proveedor')) {
      res.status(400).json({ error: 'idProveedor no existe (violación de llave foránea)' });
      return true;
    }
    if (detail.includes('id_producto')) {
      res.status(400).json({ error: 'Algún item.productId no existe (violación de llave foránea)' });
      return true;
    }
  }
  if (error.code === '22P02') { // invalid_text_representation
    res.status(400).json({ error: 'Formato inválido en algún campo numérico o de fecha' });
    return true;
  }
  if (error.code === '23514') { // check_violation
    res.status(400).json({ error: 'Violación de restricción de la base de datos' });
    return true;
  }
  return null;
}

// Mapeo camelCase -> snake_case para el encabezado de compra
const FIELD_MAP = {
  idCompra: 'id_compra',
  idProveedor: 'id_proveedor',
  fecha: 'fecha',
  metodoPago: 'metodo_pago',
  notas: 'notas',
};

function validarItems(items) {
  // se mantiene para compatibilidad con imports existentes; las validaciones reales están en mapAndValidateItems
  validateItemsLimits(items);
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
    validateHeader(payload);
    const items = mapAndValidateItems(payload.items);
    const header = mapHeaderToColumns(payload);

    const created = await purchaseModel.createPurchase({
      id_proveedor: header.id_proveedor || null,
      id_usuario: userId,
      fecha: header.fecha,
      metodo_pago: header.metodo_pago,
      notas: header.notas,
      items,
    });

    await auditModel
      .logEvent({
        entidad: 'compras',
        registroId: created.id_compra,
        accion: 'CREAR',
        usuarioId: userId,
        datosNuevos: created,
      })
      .catch((err) => console.error('No se pudo registrar auditoria de compra (create):', err.message));

    return res.status(201).json(created);
  } catch (error) {
    if (handleDbError(error, res)) return;
    if (error && error.message) return res.status(400).json({ error: error.message });
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
    if (!isPositiveInt(idCompra)) {
      return res.status(400).json({ error: 'idCompra debe ser un entero positivo' });
    }
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
    if (!isPositiveInt(idCompra)) {
      return res.status(400).json({ error: 'idCompra debe ser un entero positivo' });
    }
    const payload = req.body || {};

    const existing = await purchaseModel.getPurchaseById(idCompra, userId);
    if (!existing) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    if (payload.items !== undefined) {
      // Validar y mapear solo si viene items
      payload.items = mapAndValidateItems(payload.items);
    }

    validateHeader(payload);
    const header = mapHeaderToColumns(payload);
    const items = Array.isArray(payload.items) ? payload.items : undefined;

    const updated = await purchaseModel.updatePurchase(idCompra, userId, {
      id_proveedor: header.id_proveedor,
      fecha: header.fecha,
      metodo_pago: header.metodo_pago,
      notas: header.notas,
      items,
    });

    if (!updated) return res.status(404).json({ error: 'Compra no encontrada' });

    await auditModel
      .logEvent({
        entidad: 'compras',
        registroId: idCompra,
        accion: 'ACTUALIZAR',
        usuarioId: userId,
        datosPrevios: existing,
        datosNuevos: updated,
      })
      .catch((err) => console.error('No se pudo registrar auditoria de compra (update):', err.message));

    return res.status(200).json(updated);
  } catch (error) {
    if (handleDbError(error, res)) return;
    if (error && error.message) return res.status(400).json({ error: error.message });
    console.error('Error al actualizar compra:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function deletePurchase(req, res) {
  try {
    const userId = req.user?.id;
    const { idCompra } = req.params;
    if (!isPositiveInt(idCompra)) {
      return res.status(400).json({ error: 'idCompra debe ser un entero positivo' });
    }

    const existing = await purchaseModel.getPurchaseById(idCompra, userId);
    if (!existing) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    const deleted = await purchaseModel.deletePurchase(idCompra, userId);
    if (!deleted) return res.status(404).json({ error: 'Compra no encontrada' });

    await auditModel
      .logEvent({
        entidad: 'compras',
        registroId: idCompra,
        accion: 'ELIMINAR',
        usuarioId: userId,
        datosPrevios: existing,
      })
      .catch((err) => console.error('No se pudo registrar auditoria de compra (delete):', err.message));

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
