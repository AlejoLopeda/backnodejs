const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, saleController.createSale);
router.get('/', authMiddleware, saleController.listSales);
router.get('/:idVenta', authMiddleware, saleController.getSale);
router.put('/:idVenta', authMiddleware, saleController.updateSale);
router.delete('/:idVenta', authMiddleware, saleController.deleteSale);

module.exports = router;

