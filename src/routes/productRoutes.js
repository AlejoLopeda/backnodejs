const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, productController.createProduct);
router.put('/:idProducto', authMiddleware, productController.updateProduct);
router.delete('/:idProducto', authMiddleware, productController.deleteProduct);

module.exports = router;
