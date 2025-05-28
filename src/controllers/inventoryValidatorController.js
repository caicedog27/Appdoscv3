// src/controllers/inventoryValidatorController.js
const admin = require('../config/firebaseAdmin');
const siigoService = require('../services/siigoServicePoping');
const db = admin.firestore();

/**
 * showValidator:
 * 1) Trae todos los productos de Siigo
 * 2) Para cada producto, busca en Firebase su doc 'stockThresholds/productCode'
 * 3) Asigna un color en base a (qty, min, mid, max)
 * 4) Muestra vista validatorInventory.ejs
 */
async function showValidator(req, res) {
  try {
    // 1) Obtener todos los productos
    const allProducts = await siigoService.getAllProducts();

    // 2) Armar un array de "codes" para luego buscar en batch en Firebase
    //    Si te guiás por product.code, adelante. O si prefieres product.id, ajusta.
    const codes = allProducts.map(p => p.code || '');

    // 3) Consultar Firebase con "stockThresholds/{code}" => doc
    //    Podemos hacerlo uno por uno (no hay batch get en Firestore con doc per doc),
    //    o si hay muchos productos, habría que organizarse. Ejemplo simple aquí:
    const productMap = {}; 
    for (const prod of allProducts) {
      const code = prod.code || '';
      if (!code) continue; // si no hay code, lo saltamos

      // docRef -> 'stockThresholds/{code}'
      const docRef = db.collection('stockThresholds').doc(code);
      const snap = await docRef.get();
      let thresholds = { min: 5, mid: 10, max: 20 }; // valores por defecto
      if (snap.exists) {
        thresholds = snap.data();
      }

      productMap[code] = thresholds;
    }

    // 4) Asignar color
    const products = allProducts.map(prod => {
      const code = prod.code || '';
      const qty = prod.available_quantity || 0;
      const thresholds = productMap[code] || { min: 5, mid: 10, max: 20 };
      let color = 'red';
      if (qty >= thresholds.max) {
        color = 'blue';
      } else if (qty >= thresholds.mid) {
        color = 'green';
      } else if (qty >= thresholds.min) {
        color = 'yellow';
      }
      // Retornamos un objeto con color y umbrales
      return {
        ...prod,
        qty,
        color,
        min: thresholds.min,
        mid: thresholds.mid,
        max: thresholds.max
      };
    });

    // 5) Render
    res.render('validatorInventory', {
      title: 'Validador de Inventario (x Producto)',
      products
    });
  } catch (error) {
    console.error('Error en showValidator:', error.message);
    res.status(500).send('Error al mostrar validador de inventario');
  }
}

/**
 * showProductThresholdForm: muestra formulario para un producto
 * Recibe code por req.params o req.query
 */
async function showProductThresholdForm(req, res) {
  try {
    const { code } = req.params; // /inventarios/validador/product/CONFIG13
    if (!code) {
      return res.status(400).send('Falta "code" del producto');
    }

    // 1) Buscar doc en Firestore
    const docRef = db.collection('stockThresholds').doc(code);
    const snap = await docRef.get();
    let thresholds = { 
      productCode: code,
      productName: '',
      min: 5,
      mid: 10,
      max: 20
    };
    if (snap.exists) {
      thresholds = snap.data();
    }

    // 2) Render form
    res.render('validatorProductForm', {
      title: `Configurar Umbrales - ${code}`,
      thresholds
    });
  } catch (error) {
    console.error('Error en showProductThresholdForm:', error.message);
    res.status(500).send('Error al cargar formulario de umbral');
  }
}

/**
 * saveProductThreshold: guarda umbrales de un producto
 */
async function saveProductThreshold(req, res) {
  try {
    const { productCode, productName, min, mid, max } = req.body;
    if (!productCode) {
      return res.status(400).send('Falta productCode en el formulario');
    }

    const docRef = db.collection('stockThresholds').doc(productCode);
    const dataToSave = {
      productCode,
      productName,
      min: Number(min) || 5,
      mid: Number(mid) || 10,
      max: Number(max) || 20
    };
    await docRef.set(dataToSave, { merge: true });
    console.log('Guardado threshold para', productCode, dataToSave);

    // Redirigir al validador principal
    res.redirect('/inventarios/validador');
  } catch (error) {
    console.error('Error en saveProductThreshold:', error.message);
    res.status(500).send('Error al guardar umbral del producto');
  }
}

module.exports = {
  showValidator,
  showProductThresholdForm,
  saveProductThreshold
};
