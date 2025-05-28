/* -------------------------------------------------------------
   Controlador Inventarios – Group Flavol Solution Lab
   -------------------------------------------------------------
   ▸ Usa Node-Cache (TTL 5 min) → clave "flavorInventory".
   ▸ Se apoya en ../services/siigoServiceFlavol (token + rate-limit).
   ▸ Mantiene las mismas firmas que tu código original.
   ------------------------------------------------------------*/

const cache        = require('../cache/inventoryCache');
const siigoService = require('../services/siigoServiceFlavor');   // ← nombre del servicio
const admin        = require('firebase-admin');                   // si lo usas en otras rutas
const { parseNumber } = require('../utils/numberUtils');

/* =========================================================
 * 1) Endpoints básicos sin datos
 * =========================================================*/
exports.showInventory        = (req, res) =>
  res.render('inventarios', { title: 'Inventarios' });

exports.showProductInventory = (req, res) =>
  res.render('inventarios', { title: 'Inventario por Producto' });

exports.showInventoryCount   = (req, res) =>
  res.render('inventarios', { title: 'Conteo de Inventario' });

/* =========================================================
 * 2) Vista plana – inventoryTotal.ejs
 * =========================================================*/
exports.showTotalInventory = async (req, res) => {
  try {
    const raw = await fetchInventory(25);                 // 25-elem páginas
    const products = raw.map(p => ({
      id: p.id,
      code: p.code,
      name: p.name,
      type: p.type,
      stock_control: p.stock_control ? 'Sí' : 'No',
      available_quantity: p.available_quantity,
      warehouse_names:
        (p.warehouses || [])
          .map(w => `${w.name} (Cant.: ${w.quantity})`)
          .join(', ') || 'N/A'
    }));

    res.render('inventoryTotal', {
      layout: 'layout',
      title:  'Inventario Total – Flavor',
      products,
      totalProducts: raw.length
    });
  } catch (err) {
    console.error('[Flavor] showTotalInventory', err.message);
    res.status(500).send('Error al cargar inventario total');
  }
};

/* =========================================================
 * 3) Vista organizada – inventoryProduct.ejs
 * =========================================================*/
exports.showTotalInv = async (req, res) => {
  try {
    const products = await fetchInventory();              // cache o Siigo
    const organizedTables = organizeProducts(products);
    res.render('inventoryProduct', {
      layout: 'layout',
      title:  'Inventario Total – Flavor',
      organizedTables
    });
  } catch (err) {
    console.error('[Flavor] showTotalInv', err.message);
    res.status(500).send('Error al cargar inventario');
  }
};

/* =========================================================
 * 4) Helper – lee Node-Cache o Siigo
 * =========================================================*/
async function fetchInventory(pageSizeOverride) {
  let data = cache.get('flavorInventory');
  if (data) return data;

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
  cache.set('flavorInventory', data);          // TTL 5 min
  return data;
}

/* =========================================================
 * 5) Organizar productos por marca / presentación / sabor
 * =========================================================*/
function organizeProducts(products) {

  const brands = {
    'COCTEL PREMIUM': [
      'Tequila Sandía','Tequila Black','Ginebra Mango Biche',
      'Vodka Manzana Verde','Vodka Naranja','Aguardiente Maracuyá',
      'Crema de Wishky','Mojito','Cereza'
    ],
    'COCTEL': [
      'Aguardiente Maracuyá','Mojito','Ron Cereza','Tequila Sandía',
      'Vodka Manzana Verde','Tequila Black','Crema de Wisky',
      'Vodka Naranja','Ginebra Mango Biche'
    ],
    'SKARCHA AZUCAR': [
      'Aji','Blueberry','Cereza','Chicle','Lima Limón','Limón',
      'Mango Biche','Maracuyá','Pimienta','Sandía'
    ],
    'SKARCHA SAL': [
      'Aji','Blueberry','Cereza','Chicle','Lima Limón','Limón',
      'Mango Biche','Maracuyá','Pimienta','Sandía'
    ],
    'YEXIS': [
      'Coco','Maracuyá','Blueberry','Naranja','Café','Lyche','Fresa'
    ]
  };

  const brandOrder = ['COCTEL PREMIUM','COCTEL','SKARCHA AZUCAR','SKARCHA SAL','YEXIS'];

  const presRegex  = /(?:x\s*)?\d+\s?(ml|g|gr|kg|p)/i;
  const numericMap = { '250':'250G','500':'500G','1100':'1100G','2300':'2300G','330':'330G','3400':'3400G' };

  const tables = {};

  function normalize(str){ return str.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }

  function unifyPres(raw){
    let t = raw.toUpperCase().trim();
    t = t.replace(/^X\s+(\d+)/,'$1');
    if (/^\d+$/.test(t) && numericMap[t]) t = numericMap[t];
    t = t.replace(/(\d+)\s*(g|gr|grs)\b/i,'$1G')
         .replace(/(\d+)\s*ml\b/i,'$1ML')
         .replace(/(\d+)\s*kg\b/i,'$1KG')
         .replace(/(\d+)\s*p\b/i,'$1P');
    t = t.replace(/(\d+)p?\s*esferas?\b/i,'$1 ESFERAS')
         .replace(/\b(ESFERAS)\s+\1\b/g,'$1');
    if (/^\d+$/.test(t) && numericMap[t]) t = numericMap[t];
    return t.trim();
  }

  products.forEach(p => {
    const name = p.name || '';
    const n    = normalize(name);

    const brand = brandOrder.find(b => n.includes(normalize(b))) || 'Otro';
    if (brand === 'Otro') return;

    const flavor =
      brands[brand].find(f => n.includes(normalize(f))) || 'Otro';

    const presMatch = name.match(presRegex);
    const presentation = presMatch ? unifyPres(presMatch[0]) : 'N/A';

    const add = (label, qty) => {
      tables[label] ??= {};
      tables[label][presentation] ??= {};
      tables[label][presentation][flavor] =
        (tables[label][presentation][flavor] || 0) + qty;
    };

    if (!p.warehouses || p.warehouses.length === 0) {
      add(`${brand} Sin bodega`, parseNumber(p.available_quantity));
    } else {
      p.warehouses.forEach(w =>
        add(`${brand} ${w.name}`, parseNumber(w.quantity)));
    }
  });

  /* ── reordenar marcas según brandOrder ── */
  const orderedTables = {};
  brandOrder.forEach(b => { if (tables[b]) orderedTables[b] = tables[b]; });
  Object.keys(tables).forEach(b => { if (!orderedTables[b]) orderedTables[b] = tables[b]; });

  return orderedTables;
}
