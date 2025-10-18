const productModel = require('../models/productModel');

const REQUIRED_FIELDS = ['referencia', 'categoria', 'precio', 'nombre', 'cantidad'];

const FIELD_MAP = {
  idProducto: 'id_producto',
  referencia: 'referencia',
  categoria: 'categoria',
  precio: 'precio',
  nombre: 'nombre',
  cantidad: 'cantidad',
};

function normalizeString(value, fieldName) {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed.length) {
    throw new Error(`${fieldName} no puede estar vacio`);
  }

  return trimmed;
}

function normalizePrecio(value) {
  if (value === undefined || value === null || value === '') {
    throw new Error('precio es obligatorio');
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('precio debe ser numerico');
  }

  if (parsed < 0) {
    throw new Error('precio no puede ser negativo');
  }

  return parsed;
}

function normalizeCantidad(value) {
  if (value === undefined || value === null || value === '') {
    throw new Error('cantidad es obligatoria');
  }

  if (typeof value === 'number' && Number.isInteger(value)) {
    if (value < 0) {
      throw new Error('cantidad no puede ser negativa');
    }
    return value;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error('cantidad debe ser un numero entero');
  }

  if (parsed < 0) {
    throw new Error('cantidad no puede ser negativa');
  }

  return parsed;
}

function validateRequiredFields(payload) {
  const missing = REQUIRED_FIELDS.filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length) {
    throw new Error(`Los campos obligatorios faltantes o vacios son: ${missing.join(', ')}`);
  }
}

function mapPayloadToColumns(payload, { allowPartial = false } = {}) {
  const mapped = {};

  Object.entries(FIELD_MAP).forEach(([inputField, columnName]) => {
    if (!Object.prototype.hasOwnProperty.call(payload, inputField)) {
      return;
    }

    const rawValue = payload[inputField];

    if (rawValue === undefined) {
      return;
    }

    if (rawValue === null) {
      throw new Error(`${inputField} no puede ser nulo`);
    }

    if (rawValue === '' && inputField !== 'cantidad' && inputField !== 'precio') {
      throw new Error(`${inputField} no puede estar vacio`);
    }

    if (inputField === 'precio') {
      mapped[columnName] = normalizePrecio(rawValue);
      return;
    }

    if (inputField === 'cantidad') {
      mapped[columnName] = normalizeCantidad(rawValue);
      return;
    }

    mapped[columnName] = normalizeString(rawValue, inputField);
  });

  if (!allowPartial && !Object.keys(mapped).length) {
    throw new Error('No se proporcionaron campos validos');
  }

  return mapped;
}

function handleUniqueConstraintError(error, res) {
  if (error.code !== '23505') {
    return false;
  }

  if (error.constraint === 'productos_referencia_key' || (error.detail && error.detail.includes('referencia'))) {
    res.status(409).json({ error: 'La referencia del producto ya esta registrada.' });
    return true;
  }

  return false;
}

async function createProduct(req, res) {
  try {
    const payload = req.body || {};

    validateRequiredFields(payload);

    const productData = mapPayloadToColumns(payload);
    const created = await productModel.createProduct(productData);

    return res.status(201).json(created);
  } catch (error) {
    if (handleUniqueConstraintError(error, res)) {
      return;
    }

    if (error.message) {
      return res.status(400).json({ error: error.message });
    }

    console.error('Error al crear producto:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function updateProduct(req, res) {
  try {
    const { idProducto } = req.params;
    if (!idProducto) {
      return res.status(400).json({ error: 'idProducto es obligatorio' });
    }

    const payload = req.body || {};
    const productData = mapPayloadToColumns(payload, { allowPartial: true });

    if (!Object.keys(productData).length) {
      return res.status(400).json({ error: 'No hay campos validos para actualizar' });
    }

    const updated = await productModel.updateProduct(idProducto, productData);

    if (!updated) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    return res.status(200).json(updated);
  } catch (error) {
    if (handleUniqueConstraintError(error, res)) {
      return;
    }

    if (error.message) {
      return res.status(400).json({ error: error.message });
    }

    console.error('Error al actualizar producto:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function deleteProduct(req, res) {
  try {
    const { idProducto } = req.params;
    if (!idProducto) {
      return res.status(400).json({ error: 'idProducto es obligatorio' });
    }

    const deleted = await productModel.deleteProduct(idProducto);

    if (!deleted) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
};
