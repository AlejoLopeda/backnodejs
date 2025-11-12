const clientModel = require('../models/clientModel');
const auditModel = require('../models/auditModel');

const TIPO_TERCERO_VALUES = ['Cliente', 'Proveedor'];
const TIPO_DOCUMENTO_VALUES = ['NIT', 'CC', 'CE', 'RUC', 'DNI'];

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
const ID_FIELD_NAMES = ['idCliente', 'id_cliente'];
const PLACEHOLDER_REGEX = /\{\{.*\}\}/;

const FIELD_MAP = {
  idCliente: 'id_cliente',
  tipoTercero: 'tipo_tercero',
  nombreRazonSocial: 'nombre_razon_social',
  tipoDocumento: 'tipo_documento',
  numeroDocumento: 'numero_documento',
  correoElectronico: 'correo_electronico',
  /* telefono: 'telefono', */
  fechaCreacion: 'fecha_creacion',
  registradoPor: 'registrado_por',
};

const REQUIRED_FIELDS = [
  'tipoTercero',
  'nombreRazonSocial',
  'tipoDocumento',
  'numeroDocumento',
  'correoElectronico',
];

function isPlaceholder(value) {
  return typeof value === 'string' && PLACEHOLDER_REGEX.test(value);
}

function extractIdFromPayload(payload = {}) {
  for (const field of ID_FIELD_NAMES) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) {
      continue;
    }
    const value = payload[field];
    if (value === undefined || value === null) {
      continue;
    }
    const trimmed = String(value).trim();
    if (!trimmed || isPlaceholder(trimmed)) {
      continue;
    }
    return trimmed;
  }
  return null;
}

function resolveClientId(req) {
  const paramId = req.params?.idCliente;
  const bodyId = extractIdFromPayload(req.body);

  if (paramId && !isPlaceholder(paramId)) {
    if (bodyId && bodyId !== paramId) {
      throw new Error('El id del cuerpo debe coincidir con el parametro de ruta');
    }
    return paramId;
  }

  return bodyId || null;
}

function validateRequiredFields(payload) {
  const missing = REQUIRED_FIELDS.filter(
    (field) => payload[field] === undefined || payload[field] === null || payload[field] === ''
  );

  if (missing.length) {
    throw new Error(`Los campos obligatorios faltantes o vacios son: ${missing.join(', ')}`);
  }
}

function validateEnumValues(payload) {
  if (payload.tipoTercero !== undefined &&
      payload.tipoTercero !== null &&
      payload.tipoTercero !== '' &&
      !TIPO_TERCERO_VALUES.includes(payload.tipoTercero)) {
    throw new Error(`tipoTercero debe ser uno de: ${TIPO_TERCERO_VALUES.join(', ')}`);
  }

  if (
    payload.tipoDocumento !== undefined &&
    payload.tipoDocumento !== null &&
    payload.tipoDocumento !== '' &&
    !TIPO_DOCUMENTO_VALUES.includes(payload.tipoDocumento)
  ) {
    throw new Error(`tipoDocumento debe ser uno de: ${TIPO_DOCUMENTO_VALUES.join(', ')}`);
  }

  // estado ya no aplica
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

function handleDbError(error, res) {
  if (!error || !error.code) {
    return false;
  }

  if (error.code === '22P02') {
    res.status(400).json({ error: 'idCliente debe ser un UUID valido' });
    return true;
  }

  return false;
}

async function createClient(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const payload = req.body || {};

    validateRequiredFields(payload);
    validateEnumValues(payload);
    validateEmails(payload);

    const clientData = mapPayloadToColumns(payload);
    clientData.registrado_por = String(userId);
    const createdClient = await clientModel.createClient(clientData);

    await auditModel
      .logEvent({
        entidad: 'clientes',
        registroId: createdClient.id_cliente,
        accion: 'CREAR',
        usuarioId: userId,
        datosNuevos: createdClient,
      })
      .catch((err) => console.error('No se pudo registrar auditoria de cliente (create):', err.message));

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
    let idCliente;
    try {
      idCliente = resolveClientId(req);
    } catch (idError) {
      return res.status(400).json({ error: idError.message });
    }

    if (!idCliente) {
      return res.status(400).json({ error: 'idCliente es obligatorio' });
    }

    const client = await clientModel.getClientById(idCliente);

    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    return res.status(200).json(client);
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    if (handleDbError(error, res)) {
      return;
    }
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function updateClient(req, res) {
  try {
    let idCliente;
    try {
      idCliente = resolveClientId(req);
    } catch (idError) {
      return res.status(400).json({ error: idError.message });
    }

    const payload = req.body || {};
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    if (!idCliente) {
      return res.status(400).json({ error: 'idCliente es obligatorio' });
    }

    const existing = await clientModel.getClientById(idCliente);
    if (!existing) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
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

    await auditModel
      .logEvent({
        entidad: 'clientes',
        registroId: idCliente,
        accion: 'ACTUALIZAR',
        usuarioId: userId,
        datosPrevios: existing,
        datosNuevos: updatedClient,
      })
      .catch((err) => console.error('No se pudo registrar auditoria de cliente (update):', err.message));

    return res.status(200).json(updatedClient);
  } catch (error) {
    if (handleUniqueConstraintError(error, res)) {
      return;
    }

    if (handleDbError(error, res)) {
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
    let idCliente;
    try {
      idCliente = resolveClientId(req);
    } catch (idError) {
      return res.status(400).json({ error: idError.message });
    }
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    if (!idCliente) {
      return res.status(400).json({ error: 'idCliente es obligatorio' });
    }

    const existing = await clientModel.getClientById(idCliente);
    if (!existing) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const deletedClient = await clientModel.deleteClient(idCliente);

    if (!deletedClient) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    await auditModel
      .logEvent({
        entidad: 'clientes',
        registroId: idCliente,
        accion: 'ELIMINAR',
        usuarioId: userId || null,
        datosPrevios: existing,
      })
      .catch((err) => console.error('No se pudo registrar auditoria de cliente (delete):', err.message));

    return res.status(204).send();
  } catch (error) {
    if (handleUniqueConstraintError(error, res)) {
      return;
    }
    if (handleDbError(error, res)) {
      return;
    }
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
