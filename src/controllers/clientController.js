const clientModel = require('../models/clientModel');

const TIPO_CLIENTE_VALUES = ['Natural', 'Juridica'];
const TIPO_DOCUMENTO_VALUES = ['NIT', 'CC', 'CE', 'RUC', 'DNI'];
const ESTADO_VALUES = ['Activo', 'Inactivo'];

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;

const FIELD_MAP = {
  idCliente: 'id_cliente',
  tipoCliente: 'tipo_cliente',
  nombreRazonSocial: 'nombre_razon_social',
  tipoDocumento: 'tipo_documento',
  numeroDocumento: 'numero_documento',
  correoElectronico: 'correo_electronico',
  telefono: 'telefono',
  direccion: 'direccion',
  ciudad: 'ciudad',
  pais: 'pais',
  estado: 'estado',
  fechaCreacion: 'fecha_creacion',
  registradoPor: 'registrado_por',
  notas: 'notas',
};

const REQUIRED_FIELDS = [
  'tipoCliente',
  'nombreRazonSocial',
  'tipoDocumento',
  'numeroDocumento',
  'correoElectronico',
];

function validateRequiredFields(payload) {
  const missing = REQUIRED_FIELDS.filter(
    (field) => payload[field] === undefined || payload[field] === null || payload[field] === ''
  );

  if (missing.length) {
    throw new Error(`Los campos obligatorios faltantes o vacios son: ${missing.join(', ')}`);
  }
}

function validateEnumValues(payload) {
  if (
    payload.tipoCliente !== undefined &&
    payload.tipoCliente !== null &&
    payload.tipoCliente !== '' &&
    !TIPO_CLIENTE_VALUES.includes(payload.tipoCliente)
  ) {
    throw new Error(`tipoCliente debe ser uno de: ${TIPO_CLIENTE_VALUES.join(', ')}`);
  }

  if (
    payload.tipoDocumento !== undefined &&
    payload.tipoDocumento !== null &&
    payload.tipoDocumento !== '' &&
    !TIPO_DOCUMENTO_VALUES.includes(payload.tipoDocumento)
  ) {
    throw new Error(`tipoDocumento debe ser uno de: ${TIPO_DOCUMENTO_VALUES.join(', ')}`);
  }

  if (
    payload.estado !== undefined &&
    payload.estado !== null &&
    payload.estado !== '' &&
    !ESTADO_VALUES.includes(payload.estado)
  ) {
    throw new Error(`estado debe ser uno de: ${ESTADO_VALUES.join(', ')}`);
  }
}

function validateEmails(payload) {
  if (payload.correoElectronico !== undefined) {
    if (payload.correoElectronico === null || payload.correoElectronico === '') {
      throw new Error('correoElectronico es obligatorio');
    }
    if (!EMAIL_REGEX.test(payload.correoElectronico)) {
      throw new Error('correoElectronico no tiene un formato valido');
    }
  }
}

function mapPayloadToColumns(payload) {
  const mapped = {};

  Object.entries(FIELD_MAP).forEach(([inputField, columnName]) => {
    if (!Object.prototype.hasOwnProperty.call(payload, inputField)) {
      return;
    }

    const value = payload[inputField];

    if (value === '') {
      return;
    }

    if (value === null) {
      mapped[columnName] = null;
      return;
    }

    mapped[columnName] = value;
  });

  return mapped;
}

function handleUniqueConstraintError(error, res) {
  if (error.code !== '23505') {
    return null;
  }

  if (
    error.constraint === 'uq_clientes_correo_electronico' ||
    (error.detail && error.detail.includes('correo_electronico'))
  ) {
    res.status(409).json({ error: 'El correo electronico ya esta registrado.' });
    return true;
  }

  if (
    error.constraint === 'uq_clientes_numero_documento' ||
    (error.detail && error.detail.includes('numero_documento'))
  ) {
    res.status(409).json({ error: 'El numero de documento ya esta registrado.' });
    return true;
  }

  return null;
}

async function createClient(req, res) {
  try {
    const payload = req.body || {};

    validateRequiredFields(payload);
    validateEnumValues(payload);
    validateEmails(payload);

    const clientData = mapPayloadToColumns(payload);
    const createdClient = await clientModel.createClient(clientData);

    res.status(201).json(createdClient);
  } catch (error) {
    if (handleUniqueConstraintError(error, res)) {
      return;
    }

    if (error.message) {
      return res.status(400).json({ error: error.message });
    }

    console.error('Error al crear cliente:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function listClients(req, res) {
  try {
    const clients = await clientModel.getClients();
    res.status(200).json(clients);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getClient(req, res) {
  try {
    const { idCliente } = req.params;
    const client = await clientModel.getClientById(idCliente);

    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    return res.status(200).json(client);
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function updateClient(req, res) {
  try {
    const { idCliente } = req.params;
    const payload = req.body || {};

    if (!idCliente) {
      return res.status(400).json({ error: 'idCliente es obligatorio' });
    }

    validateEnumValues(payload);
    validateEmails(payload);

    const clientData = mapPayloadToColumns(payload);

    if (!Object.keys(clientData).length) {
      return res.status(400).json({ error: 'No hay campos validos para actualizar' });
    }

    const updatedClient = await clientModel.updateClient(idCliente, clientData);

    if (!updatedClient) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    return res.status(200).json(updatedClient);
  } catch (error) {
    if (handleUniqueConstraintError(error, res)) {
      return;
    }

    if (error.message) {
      return res.status(400).json({ error: error.message });
    }

    console.error('Error al actualizar cliente:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function deleteClient(req, res) {
  try {
    const { idCliente } = req.params;

    if (!idCliente) {
      return res.status(400).json({ error: 'idCliente es obligatorio' });
    }

    const deletedClient = await clientModel.deleteClient(idCliente);

    if (!deletedClient) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  createClient,
  listClients,
  getClient,
  updateClient,
  deleteClient,
};
