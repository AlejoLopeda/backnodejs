// app.js
const express = require('express');
const config = require('./config');
const cors = require('cors');
const { crearTablaUsuarios } = require('./models/userModel');
const { ensureClientesSchema } = require('./models/clientModel');

// Importar rutas
const userRoutes = require('./routes/userRoutes');
const clientRoutes = require('./routes/clientRoutes');

const app = express();

// Configuraci?n
app.set('port', config.app.port);
app.use(cors());
app.use(express.json());

// Usar las rutas de usuarios
app.use('/usuarios', userRoutes);
app.use('/clientes', clientRoutes);

(async () => {
  try {
    await crearTablaUsuarios();
    console.log('Tabla usuarios creada o ya existe');
    await ensureClientesSchema();
    console.log('Recursos de clientes creados o ya existen');
  } catch (error) {
    console.error('No se pudo inicializar la base de datos:', error.message);
  }
})();

module.exports = app;
