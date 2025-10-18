// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

// Rutas de usuarios
router.post('/', userController.guardarUsuario);
router.post('/login', userController.iniciarSesion);
router.get('/', authMiddleware, userController.obtenerUsuarios);

module.exports = router;
