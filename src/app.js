// app.js
const express = require('express');
const config = require('./config');
const cors = require('cors');
const { crearTablaUsuarios } = require('./models/userModel');

// Importar rutas
const userRoutes = require('./routes/userRoutes');

const app = express();

// Configuraci?n
app.set('port', config.app.port);
app.use(cors());
app.use(express.json());

// Usar las rutas de usuarios
app.use('/usuarios', userRoutes);

(async () => {
  try {
    await crearTablaUsuarios();
    console.log('Tabla usuarios creada o ya existe');
  } catch (error) {
    console.error('No se pudo inicializar la tabla users:', error.message);
  }
})();

module.exports = app;