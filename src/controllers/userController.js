const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const userModel = require('../models/userModel');

function generarToken(usuario) {
    const payload = { id: usuario.id, correo: usuario.correo };
    return jwt.sign(payload, config.auth.jwtSecret, {
        expiresIn: config.auth.jwtExpiresIn,
    });
}

function sanitizarUsuario(usuario) {
    const { password, ...resto } = usuario;
    return resto;
}

async function guardarUsuario(req, res) {
    const { nombre, correo, password } = req.body;

    if (!nombre || !correo || !password) {
        return res.status(400).json({ error: 'nombre, correo y contraseña son obligatorios' });
    }

    try {
        const existeUsuario = await userModel.obtenerUsuarioPorCorreo(correo);
        if (existeUsuario) {
            return res.status(400).json({ error: 'El correo ya esta registrado' });
        }

        const hashedPassword = await bcrypt.hash(password, config.auth.saltRounds);
        const nuevoUsuario = await userModel.insertarUsuario(nombre, correo, hashedPassword);
        const usuarioSinPassword = sanitizarUsuario(nuevoUsuario);
        const token = generarToken(nuevoUsuario);

        res.status(201).json({ usuario: usuarioSinPassword, token });
    } catch (error) {
        console.error('Error al guardar el usuario:', error.message);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

async function iniciarSesion(req, res) {
    const { correo, password } = req.body;

    if (!correo || !password) {
        return res.status(400).json({ error: 'correo y password son obligatorios' });
    }

    try {
        const usuario = await userModel.obtenerUsuarioPorCorreo(correo);
        if (!usuario) {
            return res.status(401).json({ error: 'Credenciales invalidas' });
        }

        const passwordValido = await bcrypt.compare(password, usuario.password);
        if (!passwordValido) {
            return res.status(401).json({ error: 'Credenciales invalidas' });
        }

        const usuarioSinPassword = sanitizarUsuario(usuario);
        const token = generarToken(usuario);

        res.status(200).json({ usuario: usuarioSinPassword, token });
    } catch (error) {
        console.error('Error al iniciar sesion:', error.message);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}
async function obtenerUsuarios(req, res) {
    try {
        const usuarios = await userModel.obtenerUsuarios();
        const usuariosSinPassword = usuarios.map(sanitizarUsuario);
        res.status(200).json(usuariosSinPassword);
    } catch (error) {
        console.error('Error al obtener los usuarios:', error.message);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

module.exports = {
    guardarUsuario,
    iniciarSesion,
    obtenerUsuarios,
};