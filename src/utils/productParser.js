const catalog = require('../config/productCatalog');

const normalize = str => str
  ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  : '';

function parseProduct(name = '') {
  const n = normalize(name);
  let brand = null;
  for (const key of Object.keys(catalog)) {
    if (n.includes(normalize(key))) {
      brand = key;
      break;
    }
  }
  if (!brand) return { brand: null, flavor: null, presentation: null };

  const presMatch = n.match(/(\d+\s*(ML|G|GR|KG|OZ))/);
  const presentation = presMatch ? presMatch[0].replace(/\s+/g, ' ').trim() : null;

  let flavor = null;
  const flavorRegex = /SABOR A ([^X]+)/;
  const flavorMatch = n.match(flavorRegex);
  if (flavorMatch) {
    flavor = flavorMatch[1].trim();
  } else {
    for (const f of catalog[brand].flavors) {
      if (n.includes(normalize(f))) {
        flavor = f;
        break;
      }
    }
  }

  return { brand, flavor, presentation };
}

module.exports = { parseProduct };
