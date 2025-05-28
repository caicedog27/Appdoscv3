// src/routes/inventoryRoutes.js

const express = require('express');
const router = express.Router();

// Controladores de cada tipo de inventario
const inventoryControllerPerlas  = require('../controllers/inventoryControllerPerlas');
const inventoryControllerPopping = require('../controllers/inventoryControllerPopping');
const inventoryControllerFlavor  = require('../controllers/inventoryControllerFlavor');
const inventoryController        = require('../controllers/inventoryControllerPerlas');

// Controladores adicionales
const inventoryAllProductsController = require('../controllers/inventoryMateriaPrimaController');
const inventoryValidatorController   = require('../controllers/inventoryValidatorController');
const compraProcesoController        = require('../controllers/compraProcesoController');
const inventoryConfigController      = require('../controllers/inventoryConfigController');

// Middlewares de autenticación/roles
const { checkAuth, checkRole } = require('../middlewares/authMiddleware');

// Para parsear JSON (en caso de que no lo tengas en app.js)
const bodyParser = require('body-parser');

// RUTA BASE: "/inventarios"

// ============ VISTA GENERAL (PERLAS por defecto) ============
router.get(
  '/',
  checkAuth,
  inventoryController.showInventory
);

// =============== SECCIÓN: PERLAS ===============
router.get(
  '/total/Perlas',
  checkAuth,
  checkRole(['Comercial', 'Admin']),
  inventoryControllerPerlas.showTotalInventory
);
router.get(
  '/producto/Perlas',
  checkAuth,
  checkRole(['Comercial']),  // Solo usuarios con role "Comercial"
  inventoryControllerPerlas.showTotalInv
);

// =============== SECCIÓN: POPPING ===============
router.get(
  '/total/popping',
  checkAuth,
  checkRole(['Comercial', 'Admin']),
  inventoryControllerPopping.showTotalInventory
);
router.get(
  '/producto/popping',
  checkAuth,
  checkRole(['Comercial']),
  inventoryControllerPopping.showTotalInv
);

// =============== SECCIÓN: FLAVOR ===============
router.get(
  '/total/flavor',
  checkAuth,
  checkRole(['Comercial', 'Admin']),
  inventoryControllerFlavor.showTotalInventory
);
router.get(
  '/producto/flavor',
  checkAuth,
  checkRole(['Comercial']),
  inventoryControllerFlavor.showTotalInv
);

// =============== SECCIÓN: CONTEO ===============
router.get(
  '/conteo',
  checkAuth,
  checkRole(['Comercial', 'Admin']),
  inventoryController.showInventoryCount
);

// =============== MATERIA PRIMA POPPING ===============
// Vista agrupada genérica
router.get(
  '/materiaPrima/popping',
  checkAuth,
  checkRole(['InveMateriaP']),
  inventoryAllProductsController.showGroupedByAccountGroup
);

// ============================================================================
// ==================== RUTAS DEL PROCESO DE COMPRA AVANZADO ==================
// ============================================================================
router.get(
  '/popping/procesoCompra',
  checkAuth,
  checkRole(['InveMateriaP','Admin']),
  compraProcesoController.listarCompras
);

// Al entrar al detalle => verDetalleCompra => según mainState, renderiza la vista
router.get(
  '/popping/procesoCompra/:docId',
  checkAuth,
  checkRole(['InveMateriaP','Admin']),
  compraProcesoController.verDetalleCompra
);

// Cambiar estado general (mainState)
router.post(
  '/popping/procesoCompra/:docId/changeMainState',
  checkAuth,
  checkRole(['Admin','AdminInveMateriaP']),
  express.json(), // parse JSON body
  compraProcesoController.cambiarEstadoGeneral
);

// Cambiar SOLO el estado de un item (actualizarEstadoProducto)
router.post(
  '/popping/procesoCompra/:docId/actualizarEstado',
  checkAuth,
  checkRole(['InveMateriaP','Admin']),
  express.json(),
  compraProcesoController.actualizarEstadoProducto
);

// Actualizar un producto (negotiatedPrice, providerId, etc.)
router.post(
  '/popping/procesoCompra/:docId/actualizarProducto',
  checkAuth,
  checkRole(['InveMateriaP','Admin']),
  express.json(),
  compraProcesoController.actualizarProducto
);

// Generar PDF por proveedor
router.get(
  '/popping/procesoCompra/:docId/pdf/:providerId',
  checkAuth,
  checkRole(['InveMateriaP','Admin']),
  compraProcesoController.generarPdfPorProveedor
);

// (Opcional) Adjuntar documentos => si implementas multer
// router.post(
//   '/popping/procesoCompra/:docId/adjuntar',
//   checkAuth,
//   checkRole(['InveMateriaP','Admin']),
//   upload.single('file'),
//   compraProcesoController.adjuntarDocumentos
// );

// ============================================================================
// ================= LISTA DE COMPRAS DE MATERIA PRIMA (Carrito) ==============
// ============================================================================
router.get(
  '/materiaPrima/popping/listaCompras',
  checkAuth,
  checkRole(['InveMateriaP']),
  inventoryAllProductsController.showListaComprasMp
);

router.post(
  '/materiaPrima/popping/updateInventoryConfig',
  checkAuth,
  checkRole(['InveMateriaP','Admin']),
  inventoryAllProductsController.updateInventoryConfig
);

// Buscar proveedores (Firestore + Siigo)
router.get(
  '/providers',
  checkAuth,
  checkRole(['InveMateriaP','Admin']),
  inventoryAllProductsController.searchProvidersController
);

// Finalizar lista de compra => se guarda en ComprasMp
router.post(
  '/materiaPrima/popping/finalizePurchaseList',
  checkAuth,
  checkRole(['InveMateriaP','Admin']),
  express.json(),
  inventoryAllProductsController.finalizePurchaseList
);

// ============================================================================
// ===================== VALIDADOR DE INVENTARIO ==============================
// ============================================================================
router.get(
  '/validador/popping',
  checkAuth,
  checkRole(['Admin','InveMateriaP']),
  inventoryValidatorController.showValidator
);
router.get(
  '/validador/product/:code',
  checkAuth,
  checkRole(['Admin','InveMateriaP']),
  inventoryValidatorController.showProductThresholdForm
);

// ============================================================================
// ======================= EXPORTAR LAS RUTAS =================================
// ============================================================================
module.exports = router;
