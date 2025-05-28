// src/controllers/inventoryMateriaPrimaController.js

const admin = require('../config/firebaseAdmin');
const db = admin.firestore();
const siigoService = require('../services/siigoServicePoping'); // tu servicio actual
const { parseNumber } = require('../utils/numberUtils');

// Muestra la vista principal con todos los grupos (ya lo tenías)
async function showGroupedByAccountGroup(req, res) {
  try {
    const allProducts = await siigoService.getAllProducts();
    const allDocsSnap = await db.collection('ConfCantidadesInventario').get();

    const configMap = {};
    allDocsSnap.forEach(doc => {
      configMap[doc.id] = doc.data();
    });

    const grouped = {};
    for (const prod of allProducts) {
      let groupName = prod.account_group?.name || 'SIN GRUPO';
      const codeUpper = (prod.code || '').toUpperCase().trim();

      // Subdividir "MATERIA PRIMA SABORES"
      if (groupName === 'MATERIA PRIMA SABORES') {
        if      (codeUpper.startsWith('MPET')) groupName = 'MATERIA PRIMA ETIQUETADO';
        else if (codeUpper.startsWith('MPME')) groupName = 'MATERIA PRIMA EMPAQUE';
      }

      let minVal=0, idealVal=0, maxVal=0;
      let colorName = 'transparent';
      const qty = parseNumber(prod.available_quantity);

      const data = configMap[codeUpper];
      if (data) {
        minVal   = parseFloat(data.Minimo)  || 0;
        idealVal = parseFloat(data.Ideal)   || 0;
        maxVal   = parseFloat(data.Maximo)  || 0;

        if (qty < minVal)         colorName = 'red';
        else if (qty < idealVal)  colorName = 'yellow';
        else if (qty > maxVal)    colorName = 'blue';
        else                      colorName = 'green';
      }

      prod.minValue   = minVal;
      prod.idealValue = idealVal;
      prod.maxValue   = maxVal;
      prod.colorName  = colorName;

      if (!grouped[groupName]) grouped[groupName] = [];
      grouped[groupName].push(prod);
    }

    res.render('inventoryGroupedByAG', {
      title: 'Productos Por Grupo de Inventario - Popping',
      grouped,
      totalProducts: allProducts.length
    });
  } catch (error) {
    console.error('Error showGroupedByAccountGroup:', error);
    res.status(500).send('Error al mostrar productos');
  }
}

// Muestra la vista "Lista de Compras"
async function showListaComprasMp(req, res) {
  try {
    const allProducts = await siigoService.getAllProducts();
    const allDocsSnap = await db.collection('ConfCantidadesInventario').get();
    const configMap = {};
    allDocsSnap.forEach(doc => {
      configMap[doc.id] = doc.data();
    });

    const grouped = {};
    for (const prod of allProducts) {
      let groupName = prod.account_group?.name || 'SIN GRUPO';
      const codeUpper = (prod.code || '').toUpperCase().trim();

      // Subdividir MATERIA PRIMA SABORES
      if (groupName === 'MATERIA PRIMA SABORES') {
        if      (codeUpper.startsWith('MPET')) groupName = 'MATERIA PRIMA ETIQUETADO';
        else if (codeUpper.startsWith('MPME')) groupName = 'MATERIA PRIMA EMPAQUE';
      }

      let minVal=0, idealVal=0, maxVal=0;
      let colorName = 'transparent';
      const qty = parseNumber(prod.available_quantity);

      const data = configMap[codeUpper];
      if (data) {
        minVal   = parseFloat(data.Minimo)  || 0;
        idealVal = parseFloat(data.Ideal)   || 0;
        maxVal   = parseFloat(data.Maximo)  || 0;

        if (qty < minVal)         colorName = 'red';
        else if (qty < idealVal)  colorName = 'yellow';
        else if (qty > maxVal)    colorName = 'blue';
        else                      colorName = 'green';
      }

      prod.minValue   = minVal;
      prod.idealValue = idealVal;
      prod.maxValue   = maxVal;
      prod.colorName  = colorName;

      if (!grouped[groupName]) grouped[groupName] = [];
      grouped[groupName].push(prod);
    }

    // Filtrar para solo los grupos de interés
    const allowedGroups = [
      'MATERIA PRIMA SABORES',
      'MATERIA PRIMA FABRICACION 19%',
      'MATERIA PRIMA ETIQUETADO',
      'MATERIA PRIMA EMPAQUE',
      'MATERIA PRIMA FABRICACION 5%'
    ];
    const filteredGrouped = {};
    let totalFiltered = 0;
    for (const gName of allowedGroups) {
      if (grouped[gName]) {
        filteredGrouped[gName] = grouped[gName];
        totalFiltered += grouped[gName].length;
      }
    }

    res.render('listaComprasMp', {
      title: 'Lista de Compras - Materia Prima',
      grouped: filteredGrouped,
      totalProducts: totalFiltered
    });
  } catch (error) {
    console.error('Error showListaComprasMp:', error);
    res.status(500).send('Error al mostrar la lista de compras');
  }
}

// 1) Buscar proveedores: combina Firestore + Siigo
async function searchProvidersController(req, res) {
  try {
    const query = req.query.q || ''; // ?q=...
    if (!query) {
      return res.status(400).json({ error: 'Falta el parámetro de búsqueda (q)' });
    }

    // A) Buscar proveedores locales (Firestore)
    const snap = await db.collection('ProveedoresLocal').get();
    const allLocal = [];
    snap.forEach(doc => {
      allLocal.push({
        source: 'firestore',
        id: doc.id,
        nombre: doc.data().nombre || '',
        identificacion: doc.data().identificacion || ''
      });
    });
    // Filtrar localmente
    const localFiltered = allLocal.filter(p => {
      const s = (p.nombre + ' ' + p.identificacion).toLowerCase();
      return s.includes(query.toLowerCase());
    });

    // B) Buscar proveedores en Siigo
    const siigoResult = await siigoService.searchProviders(query);
    // Mapeamos a un formato común
    const siigoMapped = siigoResult.map(s => ({
      source: 'siigo',
      id: s.id,
      nombre: s.commercial_name || s.name || '',
      identificacion: s.identification || ''
    }));

    // C) Combinar => locales primero, luego siigo
    const combined = [ ...localFiltered, ...siigoMapped ];

    return res.json({ success: true, providers: combined });
  } catch (error) {
    console.error('Error searchProvidersController:', error);
    return res.status(500).json({ error: error.message });
  }
}

// 2) Agregar nuevo proveedor => guardarlo en Firestore (y opcional en Siigo)
async function addNewProviderController(req, res) {
  try {
    const { nombre, identificacion, direccion, telefono } = req.body;
    if (!nombre) {
      return res.status(400).json({ error: 'Falta el nombre del proveedor' });
    }

    // Ejemplo: si deseas crearlo en Siigo => forms la data
    // (Si no quieres crearlo en Siigo, omite este paso)
    // ...
    // const siigoData = {
    //   type: "Customer",
    //   person_type: "Person",
    //   id_type: "13",
    //   identification: identificacion || '000000',
    //   name: [ nombre ],
    //   commercial_name: nombre,
    //   address: { address: direccion || 'SIN DIRECCION' },
    //   phones: [{ number: telefono || '' }]
    // };
    // const createdInSiigo = await siigoService.createProviderInSiigo(siigoData);

    // Guardar en Firestore (ProveedoresLocal)
    const newDocRef = await db.collection('ProveedoresLocal').add({
      nombre,
      identificacion: identificacion || '',
      direccion: direccion || '',
      telefono: telefono || '',
      createdAt: new Date()
      // siigoId: createdInSiigo.id (si usas Siigo)
      // siigoData: createdInSiigo
    });

    return res.json({
      success: true,
      provider: {
        id: newDocRef.id,
        nombre,
        identificacion,
        direccion,
        telefono
      }
    });
  } catch (error) {
    console.error('Error addNewProviderController:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Finalizar la lista de compras
async function finalizePurchaseList(req, res) {
  try {
    const { cartItems } = req.body;
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: 'No hay ítems en el carrito' });
    }

    const newDocRef = db.collection('ComprasMp').doc();
    await newDocRef.set({
      createdAt: new Date(),
      userUid: req.session?.user?.uid || null,
      items: cartItems
    });

    return res.json({
      success: true,
      message: 'Lista de compra guardada exitosamente',
      docId: newDocRef.id
    });
  } catch (error) {
    console.error('Error finalizePurchaseList:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Actualizar min/ideal/max => nuevo color
async function updateInventoryConfig(req, res) {
  try {
    const { code, min, ideal, max, qty } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Código inválido' });
    }

    const codeUpper = code.toUpperCase().trim();
    const docRef = db.collection('ConfCantidadesInventario').doc(codeUpper);
    await docRef.set({
      Minimo: parseFloat(min)   || 0,
      Ideal:  parseFloat(ideal) || 0,
      Maximo: parseFloat(max)   || 0
    }, { merge: true });

    const minVal   = parseFloat(min)   || 0;
    const idealVal = parseFloat(ideal) || 0;
    const maxVal   = parseFloat(max)   || 0;
    const currentQty = parseFloat(qty) || 0;

    let newColor = 'transparent';
    if (currentQty < minVal)        newColor = 'red';
    else if (currentQty < idealVal) newColor = 'yellow';
    else if (currentQty > maxVal)   newColor = 'blue';
    else                            newColor = 'green';

    return res.json({
      success: true,
      newColor
    });
  } catch (error) {
    console.error('Error updateInventoryConfig:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  // Vistas
  showGroupedByAccountGroup,
  showListaComprasMp,

  // Proveedores
  searchProvidersController,
  addNewProviderController,

  // Carrito
  finalizePurchaseList,

  // Config
  updateInventoryConfig
};
