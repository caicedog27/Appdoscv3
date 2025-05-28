// src/routes/profileRoutes.js

const express = require('express');
const router = express.Router();
const { checkAuth, checkRole } = require('../middlewares/authMiddleware');
const profileController = require('../controllers/profileController');

// Rutas de Perfil
router.get(
  '/',
  checkAuth,
  profileController.getProfile
);

router.post(
  '/save',
  checkAuth,
  // checkRole(['Admin']), // descomenta si quieres restringirlo a Admin
  profileController.saveProfile
);

// Rutas de Órdenes de Compra (usadas desde /perfil/...)
router.get(
  '/purchaseForm',
  checkAuth,
  // checkRole(['Compras']), // descomenta si quieres restringirlo a "Compras"
  profileController.showPurchaseForm
);

router.post(
  '/createPurchase',
  checkAuth,
  // checkRole(['Compras']),
  profileController.createPurchase
);

router.get(
  '/printPurchase/:id',
  checkAuth,
  // checkRole(['Compras']),
  profileController.printPurchase
);

module.exports = router;
