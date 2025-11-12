const saleModel = require('../models/saleModel');
const auditModel = require('../models/auditModel');

// Límites y utilidades de validación
const LIMITS = {
  maxItems: 100,
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
  if (payload.idCliente !== undefined && payload.idCliente !== null) {
    if (!isPositiveInt(payload.idCliente)) {
      throw new Error('idCliente debe ser un entero positivo');
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
    if (!isPositiveInt(quantity) || Number(quantity) > LIMITS.maxQuantity) {
      throw new Error(`items[${i}].quantity debe ser un entero > 0 y <= ${LIMITS.maxQuantity}`);
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
  if (!error || !error.code) return null;
  if (error.code === '23503') {
    const detail = (error.detail || '').toLowerCase();
    if (detail.includes('id_cliente')) {
      res.status(400).json({ error: 'idCliente no existe (violación de llave foránea)' });
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

// Mapeo camelCase -> snake_case para el encabezado de venta
const FIELD_MAP = {
  idVenta: 'id_venta',
  idCliente: 'id_cliente',
  fecha: 'fecha',
  metodoPago: 'metodo_pago',
};

// La validación de items está reforzada en mapAndValidateItems

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

// mapAndValidateItems produce las columnas correctas

async function createSale(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Usuario no autenticado' });

    const payload = req.body || {};
    validateHeader(payload);
    const items = mapAndValidateItems(payload.items);
    const header = mapHeaderToColumns(payload);

    const created = await saleModel.createSale({
      id_cliente: header.id_cliente || null,
      id_usuario: userId,
      fecha: header.fecha,
      metodo_pago: header.metodo_pago,
      items,
    });

    await auditModel
      .logEvent({
        entidad: 'ventas',
        registroId: created.id_venta,
        accion: 'CREAR',
        usuarioId: userId,
        datosNuevos: created,
      })
      .catch((err) => console.error('No se pudo registrar auditoria de venta (create):', err.message));

    return res.status(201).json(created);
  } catch (error) {
    if (handleDbError(error, res)) return;
    if (error && error.message) return res.status(400).json({ error: error.message });
    console.error('Error al crear venta:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function listSales(req, res) {
  try {
    const userId = req.user?.id;
    const rows = await saleModel.getSales(userId);
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Error al listar ventas:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getSale(req, res) {
  try {
    const userId = req.user?.id;
    const { idVenta } = req.params;
    if (!isPositiveInt(idVenta)) {
      return res.status(400).json({ error: 'idVenta debe ser un entero positivo' });
    }
    const sale = await saleModel.getSaleById(idVenta, userId);
    if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
    return res.status(200).json(sale);
  } catch (error) {
    console.error('Error al obtener venta:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function updateSale(req, res) {
  try {
    const userId = req.user?.id;
    const { idVenta } = req.params;
    if (!isPositiveInt(idVenta)) {
      return res.status(400).json({ error: 'idVenta debe ser un entero positivo' });
    }
    const payload = req.body || {};

    const existing = await saleModel.getSaleById(idVenta, userId);
    if (!existing) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    if (payload.items !== undefined) {
      payload.items = mapAndValidateItems(payload.items);
    }

    validateHeader(payload);
    const header = mapHeaderToColumns(payload);
    const items = Array.isArray(payload.items) ? payload.items : undefined;

    const updated = await saleModel.updateSale(idVenta, userId, {
      id_cliente: header.id_cliente,
      fecha: header.fecha,
      metodo_pago: header.metodo_pago,
      items,
    });

    if (!updated) return res.status(404).json({ error: 'Venta no encontrada' });

    await auditModel
      .logEvent({
        entidad: 'ventas',
        registroId: idVenta,
        accion: 'ACTUALIZAR',
        usuarioId: userId,
        datosPrevios: existing,
        datosNuevos: updated,
      })
      .catch((err) => console.error('No se pudo registrar auditoria de venta (update):', err.message));

    return res.status(200).json(updated);
  } catch (error) {
    if (handleDbError(error, res)) return;
    if (error && error.message) return res.status(400).json({ error: error.message });
    console.error('Error al actualizar venta:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function deleteSale(req, res) {
  try {
    const userId = req.user?.id;
    const { idVenta } = req.params;
    if (!isPositiveInt(idVenta)) {
      return res.status(400).json({ error: 'idVenta debe ser un entero positivo' });
    }

    const existing = await saleModel.getSaleById(idVenta, userId);
    if (!existing) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const deleted = await saleModel.deleteSale(idVenta, userId);
    if (!deleted) return res.status(404).json({ error: 'Venta no encontrada' });

    await auditModel
      .logEvent({
        entidad: 'ventas',
        registroId: idVenta,
        accion: 'ELIMINAR',
        usuarioId: userId,
        datosPrevios: existing,
      })
      .catch((err) => console.error('No se pudo registrar auditoria de venta (delete):', err.message));

    return res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar venta:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  createSale,
  listSales,
  getSale,
  updateSale,
  deleteSale,
};

