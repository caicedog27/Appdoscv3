// src/routes/purchaseRoutes.js
const express = require('express');
const router = express.Router();
const { checkAuth, checkRole } = require('../middlewares/authMiddleware');
const purchaseController = require('../controllers/purchaseController');

router.get(
  '/new',
  checkAuth,
  checkRole(['Compras']),
  purchaseController.showPurchaseForm
);

router.post(
  '/',
  checkAuth,
  checkRole(['Compras']),
  purchaseController.createPurchase
);

router.get(
  '/print/:id',
  checkAuth,
  checkRole(['Compras']),
  purchaseController.printPurchase
);

// AJAX - buscar proveedores
router.get(
  '/search/providers',
  checkAuth,
  checkRole(['Compras']),
  purchaseController.searchProviders
);

// AJAX - buscar productos
router.get(
  '/search/products',
  checkAuth,
  checkRole(['Compras']),
  purchaseController.searchProducts
);

// Opcional: logProduct, logTax
router.post(
  '/logProduct',
  checkAuth,
  checkRole(['Compras']),
  purchaseController.logProduct
);
router.post(
  '/logTax',
  checkAuth,
  checkRole(['Compras']),
  purchaseController.logTax
);

module.exports = router;
