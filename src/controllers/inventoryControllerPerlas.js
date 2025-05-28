/* =============================================================
   Controlador Inventarios – Perlas Explosivas
   =============================================================
   ▸ Mantiene todas las rutas y la caché Node-Cache (TTL 5 min)
   ▸ Filtra bodegas con ALLOWED_WAREHOUSES
   ▸ 🔊  LOG en consola:  «CODE | NAME | BODEGA | QTY»
   ============================================================*/

const cache        = require('../cache/inventoryCache');
const siigoService = require('../services/siigoServicePerlas');
const admin        = require('firebase-admin');   // si lo usas (no se quita)
const { parseNumber } = require('../utils/numberUtils');

/* ───── Modifica para ver solo las bodegas que te interesen ──── */
const ALLOWED_WAREHOUSES = [
  'BODEGA PRINCIPAL',
  'PRODUCCIÓN',
  'MÁQUINA 1'
];


/* =========================================================
 * 1) Rutas “vacías”
 * =========================================================*/
exports.showInventory        = (req, res) =>
  res.render('inventarios', { title: 'Inventarios' });

exports.showProductInventory = (req, res) =>
  res.render('inventarios', { title: 'Inventario por Producto' });

exports.showInventoryCount   = (req, res) =>
  res.render('inventarios', { title: 'Conteo de Inventario' });

/* =========================================================
 * 2) Tabla plana
 * =========================================================*/
exports.showTotalInventory = async (_req, res) => {
  try {
    const data = await fetchInventory(25);

    const products = data.map(p => {
      const wh = (p.warehouses || [])
        .filter(w => !ALLOWED_WAREHOUSES.length ||
                     ALLOWED_WAREHOUSES.includes(w.name));

      const stock = wh.length
        ? wh.reduce((s, w) => s + parseNumber(w.quantity), 0)
        : parseNumber(p.available_quantity);

      return {
        id:   p.id,
        code: p.code,
        name: p.name,
        stock_control: p.stock_control ? 'Sí' : 'No',
        available_quantity: stock,
        warehouse_names:
          wh.map(w => `${w.name} (${w.quantity})`).join(', ') || 'N/A'
      };
    });

    res.render('inventoryTotal', {
      layout: 'layout',
      title:  'Inventario Total – Perlas',
      products,
      totalProducts: data.length
    });
  } catch (e) {
    console.error('[Perlas] showTotalInventory:', e.message);
    res.status(500).send('Error al cargar inventario total');
  }
};

/* =========================================================
 * 3) Vista “organizada rápido”
 * =========================================================*/
exports.showOrganizedInventory = async (_req, res) => {
  try {
    const products        = await fetchInventory();
    const organizedTables = quickBrandOrganization(products);

    res.render('inventoryProduct', {
      layout: 'layout',
      title:  'Inventario por Producto – Perlas',
      organizedTables,
      grouped: organizedTables
    });
  } catch (e) {
    console.error('[Perlas] showOrganizedInventory:', e.message);
    res.status(500).send('Error al cargar inventario organizado');
  }
};

/* =========================================================
 * 4) Vista agrupada completa
 * =========================================================*/
exports.showTotalInv = async (_req, res) => {
  try {
    const products        = await fetchInventory();
    const organizedTables = organizeProducts(products);

    res.render('inventoryProduct', {
      layout: 'layout',
      title:  'Inventario Total – Perlas',
      organizedTables,
      grouped: organizedTables
    });
  } catch (e) {
    console.error('[Perlas] showTotalInv:', e.message);
    res.status(500).send('Error al cargar inventario total');
  }
};

/* =========================================================
 * 5) Cache helper
 * =========================================================*/
async function fetchInventory(pageSize) {
  let data = cache.get('perlasInventory');
  if (data) return data;

  if (pageSize) {
    let pg = 1, pages = 1, out = [];
    do {
      const r = await siigoService.getProducts(pg, pageSize);
      out.push(...(r.results || []));
      pages = Math.ceil(r.pagination.total_results / pageSize);
      pg++;
    } while (pg <= pages);
    data = out;
  } else {
    data = await siigoService.getAllProducts();
  }
  cache.set('perlasInventory', data, 300);   // 5 min
  return data;
}

/* =========================================================
 * 6) Organización rápida (opcional)
 * =========================================================*/
function quickBrandOrganization(products) {
  const brands = {
    Liquipops: [
      'Blueberry','Fresa','Manzana Verde','Lychee','Cereza','Mango Biche',
      'Pink','Maracuyá','Chicle','Sandía','Coco','Café'
    ]
    //  … añade si necesitas …
  };
  const tables = {};
  products.forEach(p=>{
    const brand = Object.keys(brands).find(b=>p.name.includes(b));
    if(!brand) return;

    const pres   = p.name.match(/\d+\s?(ml|g|gr|onz)/i)?.[0] || 'N/A';
    const flavor = brands[brand].find(f=>p.name.toLowerCase().includes(f.toLowerCase())) || 'Otro';

    tables[brand] ??= {};
    tables[brand][pres] ??= {};
    tables[brand][pres][flavor] =
      (tables[brand][pres][flavor]||0)+parseNumber(p.available_quantity);
  });
  return tables;
}

/* =========================================================
 * 7) ORGANIZEPRODUCTS  (con logs por producto / bodega)
 * =========================================================*/
const additionalProducts = [
  'CAJA KIT NUEVO','CUCHARA COMESTIBLE X 1 UN','BORDEADOR DE COPAS',
  // … (lista completa igual que antes) …
];

function organizeProducts(products) {
  const brands = {
    Liquipops: [
      'Blueberry','Fresa','Manzana Verde','Lychee','Cereza','Mango Biche',
      'Pink','Maracuyá','Chicle','Sandía','Coco','Café','Mango Biche Con Sal'
    ],
    'SIROPE GENIALITY': [
      'Blueberry','Fresa','Manzana Verde','Lychee','Cereza','Mango Biche',
      'Maracuyá','Curacao','Granadina','Sandía','Jarabe','Ice Pink',
      'Escarchador','ESCARCHADOR','Caramelo','Vainilla'
    ]
    // … tus demás marcas …
  };

  const norm   = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const presRx = /(x\s*\d+)|(\d+\s*(ml|g|gr|kg|p))|(\d+p?\s*esferas?)/i;
  const numeric = { '330':'330G','1100':'1100G','1150':'1150G','2300':'2300G',
                    '3400':'3400G','360':'360ML','1000':'1000ML' };

  const tables = {};

  products.forEach(p=>{
    const whs = (p.warehouses||[])
      .filter(w => !ALLOWED_WAREHOUSES.length ||
                   ALLOWED_WAREHOUSES.includes(w.name));

    const isAdd    = additionalProducts.some(x => norm(x) === norm(p.name||''));
    const baseBrand=
      Object.keys(brands).find(b=>norm(p.name).includes(norm(b)))||
      (isAdd ? 'ADICIONALES' : 'OTRO');

    const listFlav = brands[baseBrand] || [];
    const flavor   =
      listFlav.find(f=>norm(p.name).includes(norm(f))) ||
      (isAdd ? p.name : 'Otro');

    let pres = (p.name||'').match(presRx)?.[0]?.toUpperCase().trim() || 'U/N';
    pres = pres.replace(/^X\s+/i,'');
    if (/^\d+$/.test(pres) && numeric[pres]) pres = numeric[pres];
    pres = pres
      .replace(/(\d+)\s*(g|gr|grs)/i,'$1G')
      .replace(/(\d+)\s*ml/i,'$1ML')
      .replace(/(\d+)\s*kg/i,'$1KG')
      .replace(/(\d+)\s*p/i,'$1P')
      .replace(/(\d+)p?\s*esferas?/i,'$1 ESFERAS')
      .replace(/\b(ESFERAS)\s+\1\b/g,'$1')
      .trim();

    /*  LOG por bodega  */
    if (!whs.length) {
      console.log(`${p.code} | ${p.name} | Sin bodega | ${p.available_quantity}`);
      addQty(`${baseBrand} Sin bodega`, parseNumber(p.available_quantity));
    } else {
      whs.forEach(w=>{
        console.log(`${p.code} | ${p.name} | ${w.name} | ${w.quantity}`);
        addQty(`${baseBrand} ${w.name}`, parseNumber(w.quantity));
      });
    }

    function addQty(label, qty){
      tables[label] ??= {};
      tables[label][pres] ??= {};
      tables[label][pres][flavor] =
        (tables[label][pres][flavor] || 0) + qty;
    }
  });

  return tables;
}
