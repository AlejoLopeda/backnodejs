const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, purchaseController.createPurchase);
router.get('/', authMiddleware, purchaseController.listPurchases);
router.get('/:idCompra', authMiddleware, purchaseController.getPurchase);
router.put('/:idCompra', authMiddleware, purchaseController.updatePurchase);
router.delete('/:idCompra', authMiddleware, purchaseController.deletePurchase);

module.exports = router;

