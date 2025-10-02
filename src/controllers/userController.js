// controllers/userController.js
const userModel = require('../models/userModel');

// Controlador para guardar un usuario
async function guardarUsuario(req, res) {
  const { nombre, correo, password } = req.body;

  try {
    // Verificar si ya existe el correo
    const existeUsuario = await userModel.obtenerUsuarioPorCorreo(correo);
    if (existeUsuario) {
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }

    // Guardar el nuevo usuario
    const nuevoUsuario = await userModel.insertarUsuario(nombre, correo, password);
    res.status(201).json(nuevoUsuario);
  } catch (error) {
    console.error('Error al guardar el usuario:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Controlador para obtener todos los usuarios
async function obtenerUsuarios(req, res) {
  try {
    const usuarios = await userModel.obtenerUsuarios();
    res.status(200).json(usuarios);
  } catch (error) {
    console.error('Error al obtener los usuarios:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  guardarUsuario,
  obtenerUsuarios,
};
