const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, clientController.createClient);
router.get('/', authMiddleware, clientController.listClients);
router.get('/:idCliente', authMiddleware, clientController.getClient);
router.put('/:idCliente', authMiddleware, clientController.updateClient);
router.delete('/:idCliente', authMiddleware, clientController.deleteClient);

module.exports = router;
