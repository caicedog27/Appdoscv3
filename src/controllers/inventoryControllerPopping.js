/* -------------------------------------------------------------
   Controlador Inventarios – Popping Boba International
   -------------------------------------------------------------
   ▸ Usa caché en memoria (Node-Cache, TTL 5 min) para evitar
     llamadas repetidas a Siigo.
   ▸ Mantiene TODAS las rutas/firmas que tu app ya invoca.
   ------------------------------------------------------------*/

const cache        = require('../cache/inventoryCache');      // Node-Cache
const siigoService = require('../services/siigoServicePoping');
const admin        = require('firebase-admin');               // sigue disponible
const { parseNumber } = require('../utils/numberUtils');
const { parseProduct } = require('../utils/productParser');

/* =========================================================
 * 1) Endpoints “básicos” (sin datos)
 * =========================================================*/
exports.showInventory        = (req, res) =>
  res.render('inventarios', { title: 'Inventarios' });

exports.showProductInventory = (req, res) =>
  res.render('inventarios', { title: 'Inventario por Producto' });

exports.showInventoryCount   = (req, res) =>
  res.render('inventarios', { title: 'Conteo de Inventario' });

/* =========================================================
 * 2) Inventario Total – vista plana (inventoryTotal.ejs)
 * =========================================================*/
exports.showTotalInventory = async (req, res) => {
  try {
    const raw = await fetchInventory(25);               // paginación 25
    const products = raw.map(p => ({
      id:    p.id,
      code:  p.code,
      name:  p.name,
      type:  p.type,
      stock_control: p.stock_control ? 'Sí' : 'No',
      available_quantity: p.available_quantity,
      warehouse_names:
        (p.warehouses || [])
          .map(w => `${w.name} (Cant.: ${w.quantity})`)
          .join(', ') || 'N/A'
    }));

    res.render('inventoryTotal', {
      layout: 'layout',
      title:  'Inventario Total – Popping',
      products,
      totalProducts: raw.length
    });
  } catch (err) {
    console.error('[Popping] showTotalInventory', err.message);
    res.status(500).send('Error al cargar inventario total');
  }
};

/* =========================================================
 * 3) Inventario Total Organizado (inventoryProduct.ejs)
 * =========================================================*/
exports.showTotalInv = async (req, res) => {
  try {
    const products = await fetchInventory();            // usa caché
    const organizedTables = organizeProducts(products);
    const reorderedTables = reorderBrandKeys(organizedTables);

    res.render('inventoryProduct', {
      layout: 'layout',
      title:  'Inventario Total – Popping',
      organizedTables: reorderedTables
    });
  } catch (err) {
    console.error('[Popping] showTotalInv', err.message);
    res.status(500).send('Error al cargar inventario');
  }
};

/* =========================================================
 * 4) Helper – lee caché o Siigo
 * =========================================================*/
async function fetchInventory(pageSizeOverride) {
  let data = cache.get('poppingInventory');
  if (data) return data;                           // 💨 hit

  if (pageSizeOverride) {
    let cur = 1, pages = 1, out = [];
    do {
      const r = await siigoService.getProducts(cur, pageSizeOverride);
      out.push(...(r.results || []));
      pages = Math.ceil(r.pagination.total_results / pageSizeOverride);
      cur++;
    } while (cur <= pages);
    data = out;
  } else {
    data = await siigoService.getAllProducts();
  }
  cache.set('poppingInventory', data);             // TTL 5 min
  return data;
}

/* =========================================================
 * 5) Reordenar marcas (LIQUIPOPS → SIROPE → WOW → resto)
 * =========================================================*/
const brandPriority = ['LIQUIPOPS', 'SIROPE GENIALITY', 'WOW'];

function reorderBrandKeys(obj) {
  const out = {};
  brandPriority.forEach(b => { if (obj[b]) out[b] = obj[b]; });
  Object.keys(obj).forEach(b => { if (!out[b]) out[b] = obj[b]; });
  return out;
}

/* =========================================================
 * 6) Organizar productos por marca / presentación / sabor
 * =========================================================*/
function organizeProducts(products) {
  const tables = {};

  products.forEach(p => {
    const { brand, flavor, presentation } = parseProduct(p.name);
    if (!brand) return;

    const pres = presentation ? presentation.toUpperCase() : 'N/A';
    const flv  = flavor ? flavor : 'Otro';

    const addQty = (label, qty) => {
      tables[label] ??= {};
      tables[label][pres] ??= {};
      tables[label][pres][flv] =
        (tables[label][pres][flv] || 0) + qty;
    };

    if (!p.warehouses || p.warehouses.length === 0) {
      addQty(`${brand} Sin bodega`, parseNumber(p.available_quantity));
    } else {
      p.warehouses.forEach(w =>
        addQty(`${brand} ${w.name}`, parseNumber(w.quantity)));
    }
  });

  return tables;
}
