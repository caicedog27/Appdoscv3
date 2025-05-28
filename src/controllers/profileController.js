/**
 * Se asume que tu index.js (o app.js) exporta `db`,
 * y que `require('../..')` realmente apunta a ese archivo.
 * De lo contrario, ajústalo a la ruta real donde exportes `db`.
 */
const db = require('../..');

// Si usas el servicio de Siigo (o cualquier otro):
const siigoService = require('../services/siigoServicePoping');

/**
 * 1) Lógica de Perfil
 */

// GET /perfil
exports.getProfile = async (req, res) => {
  try {
    const doc = await db.collection('empresa').doc('perfil').get();
    if (doc.exists) {
      res.render('perfil', { 
        title: 'Configuración de Perfil', 
        profile: doc.data() 
      });
    } else {
      res.render('perfil', { 
        title: 'Configuración de Perfil', 
        profile: {} 
      });
    }
  } catch (error) {
    console.error('Error al obtener el perfil:', error);
    res.status(500).send('Error al obtener el perfil.');
  }
};

// POST /perfil/save
exports.saveProfile = async (req, res) => {
  try {
    const { nombre, direccion, telefono, email } = req.body;

    await db.collection('empresa').doc('perfil').set({
      nombre,
      direccion,
      telefono,
      email,
    });

    res.redirect('/perfil');
  } catch (error) {
    console.error('Error al guardar el perfil:', error);
    res.status(500).send('Error al guardar el perfil.');
  }
};

/**
 * 2) Lógica de creación de Órdenes de Compra
 */

// GET /perfil/purchaseForm (por ejemplo) => Muestra el formulario de Orden de Compra
exports.showPurchaseForm = async (req, res) => {
  try {
    // 1) Obtener Proveedores, Productos e Impuestos desde Siigo
    const providersResp = await siigoService.getProviders();
    const allProviders = providersResp.results; // Ajusta según tu estructura

    const products = await siigoService.getAllProducts();
    const taxes = await siigoService.getTaxes(); // IVA, retenciones, etc.

    // 2) Renderizar vista EJS con combos
    res.render('purchaseForm', {
      title: 'Crear Orden de Compra',
      providers: allProviders,
      products,
      taxes
    });
  } catch (error) {
    console.error('Error en showPurchaseForm:', error.message);
    return res
      .status(500)
      .send('Ocurrió un error al cargar el formulario de Orden de Compra');
  }
};

// POST /perfil/createPurchase => Crear la OC
exports.createPurchase = async (req, res) => {
  try {
    const {
      providerId,
      providerName,
      items,
      notes
      // ... lo que necesites
    } = req.body;

    // A) Generar número de orden
    const purchaseOrdersRef = db.collection('purchaseOrders');
    const snapshot = await purchaseOrdersRef.get();
    const nextOrderNum = snapshot.size + 1;

    // B) Calcular totales
    let subTotal = 0;
    let totalDiscount = 0;
    let totalTaxes = 0;
    let total = 0;

    (items || []).forEach((item) => {
      const qty = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      const discount = Number(item.discount || 0);

      const line = qty * price;
      subTotal += line;
      totalDiscount += discount;
      // totalTaxes += line * (porcentaje/100), etc., si aplicas IVA
    });

    total = subTotal - totalDiscount + totalTaxes;

    // C) Guardar en Firestore
    const newOrder = {
      orderNumber: nextOrderNum,
      providerId,
      providerName,
      items: items || [],
      subTotal,
      totalDiscount,
      totalTaxes,
      total,
      notes,
      createdAt: new Date()
    };

    const docRef = await purchaseOrdersRef.add(newOrder);

    // D) Redirigir a la vista “imprimir”
    res.redirect(`/perfil/printPurchase/${docRef.id}`);
  } catch (error) {
    console.error('Error al crear Orden de Compra:', error.message);
    res.status(500).send('Error al crear la Orden de Compra');
  }
};

// GET /perfil/printPurchase/:id => Muestra Orden en modo imprimible
exports.printPurchase = async (req, res) => {
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
    res.status(500).send('Ocurrió un error al mostrar la impresión');
  }
};
