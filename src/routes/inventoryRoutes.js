/************************************************************
 * src/routes/inventoryRoutes.js
 * ───────────────────────────────────────────────────────────
 * • Todas las empresas (Perlas, Popping, Flavor) usan
 *   controladores con caché de 5 min.
 * • La ruta raíz /inventarios sigue mostrando Perlas.
 ************************************************************/
const express   = require('express');
const router    = express.Router();
const multer    = require('multer');
const upload    = multer({ dest: 'uploads/' });

/* ──────────────────────────────────────────────────────────
   Controladores por empresa
   ─────────────────────────────────────────────────────────*/
const ctlPerlas   = require('../controllers/inventoryControllerPerlas');
const ctlPopping  = require('../controllers/inventoryControllerPopping');
const ctlFlavor   = require('../controllers/inventoryControllerFlavor');

/* Controlador genérico (inicio)  */
const inventoryController = ctlPerlas;

/* Otros controladores */
const allProductsCtl = require('../controllers/inventoryMateriaPrimaController');
const validatorCtl   = require('../controllers/inventoryValidatorController');
const compraCtl      = require('../controllers/compraProcesoController');

/* Middlewares */
const { checkAuth, checkRole } = require('../middlewares/authMiddleware');
const expressJson = express.json;

/* ──────────────────────────────────────────────────────────
   RUTA BASE  (/inventarios)
   ─────────────────────────────────────────────────────────*/
router.get('/', checkAuth, inventoryController.showInventory);

/* =========================================================
 * PERLAS
 * =========================================================*/
router.get(
  '/total/perlas',
  checkAuth,
  checkRole(['Comercial', 'Admin']),
  ctlPerlas.showTotalInventory        // vista plana
);

router.get(
  '/producto/perlas',
  checkAuth,
  checkRole(['Comercial']),
  ctlPerlas.showTotalInv              // vista organizada (v3)
);

router.get(                               // (opcional) versión 2
  '/producto/perlas/organizado',
  checkAuth,
  checkRole(['Comercial']),
  ctlPerlas.showOrganizedInventory
);

/* =========================================================
 * POPPING
 * =========================================================*/
router.get(
  '/total/popping',
  checkAuth,
  checkRole(['Comercial', 'Admin']),
  ctlPopping.showTotalInventory
);

router.get(
  '/producto/popping',
  checkAuth,
  checkRole(['Comercial']),
  ctlPopping.showTotalInv
);

/* =========================================================
 * FLAVOR
 * =========================================================*/
router.get(
  '/total/flavor',
  checkAuth,
  checkRole(['Comercial', 'Admin']),
  ctlFlavor.showTotalInventory
);

router.get(
  '/producto/flavor',
  checkAuth,
  checkRole(['Comercial']),
  ctlFlavor.showTotalInv
);

/* =========================================================
 * CONTEO GLOBAL
 * =========================================================*/
router.get(
  '/conteo',
  checkAuth,
  checkRole(['Comercial', 'Admin']),
  inventoryController.showInventoryCount
);

/* =========================================================
 * MATERIA PRIMA  – POPPING
 * =========================================================*/
router.get(
  '/materiaPrima/popping',
  checkAuth,
  checkRole(['InveMateriaP']),
  allProductsCtl.showGroupedByAccountGroup
);

/* =========================================================
 * PROCESO DE COMPRA  – POPPING
 * =========================================================*/
router.get(
  '/popping/procesoCompra',
  checkAuth,
  checkRole(['InveMateriaP', 'Admin']),
  compraCtl.listarCompras
);

router.get(
  '/popping/procesoCompra/:docId',
  checkAuth,
  checkRole(['InveMateriaP', 'Admin']),
  compraCtl.verDetalleCompra
);

router.post(
  '/popping/procesoCompra/:docId/changeMainState',
  checkAuth,
  checkRole(['Admin', 'InveMateriaP']),
  expressJson(),
  compraCtl.cambiarEstadoGeneral
);

router.post(
  '/popping/procesoCompra/:docId/actualizarItem',
  checkAuth,
  checkRole(['InveMateriaP', 'Admin']),
  expressJson(),
  compraCtl.actualizarItem
);

router.post(
  '/popping/procesoCompra/:docId/setArrival',
  checkAuth,
  checkRole(['Admin', 'InveMateriaP']),
  expressJson(),
  compraCtl.setArrivalData
);

router.get(
  '/popping/procesoCompra/:docId/pdf/:providerId',
  checkAuth,
  checkRole(['InveMateriaP', 'Admin']),
  compraCtl.generarPdfPorProveedor
);

router.get(
  '/popping/procesoCompra/:docId/pdfListaInicial',
  checkAuth,
  checkRole(['InveMateriaP', 'Admin']),
  compraCtl.generarPdfListaNegociacion
);

router.get(
  '/popping/procesoCompra/:docId/ordenCompraPdf',
  checkAuth,
  checkRole(['InveMateriaP', 'Admin']),
  compraCtl.generateOrdenCompraPdf
);

router.get(
  '/popping/procesoCompra/:docId/ordenCompraPdf/:providerId',
  checkAuth,
  checkRole(['InveMateriaP', 'Admin']),
  compraCtl.generateOrdenCompraPdfForProvider
);

router.post(
  '/popping/procesoCompra/:docId/setArrivalByProvider/:providerId',
  checkAuth,
  checkRole(['InveMateriaP', 'Admin']),
  upload.single('soportePago'),
  compraCtl.setArrivalByProvider
);

/* =========================================================
 * LISTA DE COMPRAS – MATERIA PRIMA  (POPPING)
 * =========================================================*/
router.get(
  '/materiaPrima/popping/listaCompras',
  checkAuth,
  checkRole(['InveMateriaP']),
  allProductsCtl.showListaComprasMp
);

router.post(
  '/materiaPrima/popping/updateInventoryConfig',
  checkAuth,
  checkRole(['InveMateriaP', 'Admin']),
  allProductsCtl.updateInventoryConfig
);

/* Buscar proveedores */
router.get(
  '/providers',
  checkAuth,
  checkRole(['InveMateriaP', 'Admin']),
  allProductsCtl.searchProvidersController
);

/* Finalizar lista de compra */
router.post(
  '/materiaPrima/popping/finalizePurchaseList',
  checkAuth,
  checkRole(['InveMateriaP', 'Admin']),
  expressJson(),
  allProductsCtl.finalizePurchaseList
);

/* =========================================================
 * VALIDADOR DE INVENTARIO
 * =========================================================*/
router.get(
  '/validador/popping',
  checkAuth,
  checkRole(['Admin', 'InveMateriaP']),
  validatorCtl.showValidator
);

router.get(
  '/validador/product/:code',
  checkAuth,
  checkRole(['Admin', 'InveMateriaP']),
  validatorCtl.showProductThresholdForm
);

/* ──────────────────────────────────────────────────────────*/
module.exports = router;
