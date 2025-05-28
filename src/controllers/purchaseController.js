// src/controllers/purchaseController.js

const admin = require('../config/firebaseAdmin');
const db = admin.firestore();
const siigoService = require('../services/siigoServicePoping');

/**
 * GET /purchase/new => Muestra el formulario
 */
async function showPurchaseForm(req, res) {
  try {
    const taxes = await siigoService.getTaxes();
    res.render('purchaseForm', {
      title: 'Crear Orden de Compra',
      taxes
    });
  } catch (error) {
    console.error('Error en showPurchaseForm:', error.response?.data || error.message);
    throw new Error('No se pudo obtener impuestos');
  }
}

/**
 * POST /purchase => crea la OC en Firestore
 */
async function createPurchase(req, res) {
  try {
    const {
      orderDate,
      providerId,
      providerName,
      providerRUT,
      providerAddress,
      providerPhone,
      items,
      notes
    } = req.body;

    // 1) Buscar la última orden => correlativo
    let nextOrderNum = 1;
    const purchaseOrdersRef = db.collection('purchaseOrders');
    const lastDocSnap = await purchaseOrdersRef
      .orderBy('orderNumber', 'desc')
      .limit(1)
      .get();
    if (!lastDocSnap.empty) {
      const lastDoc = lastDocSnap.docs[0].data();
      nextOrderNum = (lastDoc.orderNumber || 0) + 1;
    }

    // 2) Calcular totales
    let subTotal         = 0;
    let totalDiscount    = 0;
    let totalIVA         = 0;
    let totalRetenciones = 0;
    let totalImpoConsumo = 0;
    let grandTotal       = 0;

    (items || []).forEach((item) => {
      const qty      = Number(item.quantity || 0);
      const price    = Number(item.price || 0);
      const discount = Number(item.discount || 0);

      const lineBase = qty * price;
      subTotal      += lineBase;
      totalDiscount += discount;

      const taxableBase = lineBase - discount;

      // item.taxes => array con { type, percentage }
      if (item.taxes && Array.isArray(item.taxes)) {
        item.taxes.forEach(taxObj => {
          const perc = Number(taxObj.percentage || 0) / 100;
          const taxAmount = taxableBase * perc;
          switch (taxObj.type) {
            case 'IVA':
              totalIVA += taxAmount;
              break;
            case 'Retefuente':
            case 'RetICA':
            case 'RetIVA':
              totalRetenciones += taxAmount;
              break;
            case 'Impoconsumo':
              totalImpoConsumo += taxAmount;
              break;
            default:
              break;
          }
        });
      }
    });

    const baseNeta = subTotal - totalDiscount;
    grandTotal     = baseNeta + totalIVA + totalImpoConsumo - totalRetenciones;

    // 3) Guardar en Firestore
    const newOrder = {
      orderNumber: nextOrderNum,
      orderDate:   orderDate || new Date(),
      providerId,
      providerName,
      providerRUT,
      providerAddress,
      providerPhone,
      items: items || [],
      subTotal,
      totalDiscount,
      totalIVA,
      totalRetenciones,
      totalImpoConsumo,
      grandTotal,
      notes,
      createdAt: new Date()
    };

    const docRef = await purchaseOrdersRef.add(newOrder);
    res.redirect(`/purchase/print/${docRef.id}`);
  } catch (error) {
    console.error('Error al crear Orden de Compra:', error.message);
    res.status(500).send('Error al crear la Orden de Compra');
  }
}

/**
 * GET /purchase/print/:id => imprimir/ver
 */
async function printPurchase(req, res) {
  try {
    const { id } = req.params;
    const docSnap = await db.collection('purchaseOrders').doc(id).get();
    if (!docSnap.exists) {
      return res.status(404).send('No se encontró la Orden de Compra');
    }
    const order = docSnap.data();

    res.render('purchasePrint', {
      title: `Orden de Compra #${order.orderNumber}`,
      order
    });
  } catch (error) {
    console.error('Error en printPurchase:', error.message);
    res.status(500).send('Error al mostrar la impresión');
  }
}

/**
 * GET /purchase/search/providers?q=texto
 */
async function searchProviders(req, res) {
  try {
    const q = req.query.q || '';
    const results = await siigoService.searchProviders(q);
    return res.json({ success: true, data: results });
  } catch (err) {
    console.error('Error en searchProviders:', err);
    return res.json({ success: false, message: 'Error al buscar proveedores' });
  }
}

/**
 * GET /purchase/search/products?q=texto
 */
async function searchProducts(req, res) {
  try {
    const q = req.query.q || '';
    const results = await siigoService.searchProducts(q);
    return res.json({ success: true, data: results });
  } catch (err) {
    console.error('Error en searchProducts:', err);
    return res.json({ success: false, message: 'Error al buscar productos' });
  }
}

/**
 * POST /purchase/logProduct => debug
 */
function logProduct(req, res) {
  console.log('Producto seleccionado en servidor:', req.body);
  res.json({ success: true });
}

/**
 * POST /purchase/logTax => debug
 */
function logTax(req, res) {
  console.log('Impuesto seleccionado en servidor:', req.body);
  res.json({ success: true });
}

module.exports = {
  showPurchaseForm,
  createPurchase,
  printPurchase,
  searchProviders,
  searchProducts,
  logProduct,
  logTax
};
