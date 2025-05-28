/**
 * cron/inventorySyncFlavor.js
 * ---------------------------------------------------------
 * Refresca cada 5 min el inventario de Flavor
 *   -> clave cache: "flavorInventory"
 */
const cache        = require('../src/cache/inventoryCache');
const siigoService = require('../src/services/siigoServiceFlavor');

async function refreshInventory () {
  try {
    const data = await siigoService.getAllProducts();
    cache.set('flavorInventory', data);
    console.log('[CRON-Flavor] inventario actualizado', new Date());
  } catch (err) {
    console.error('[CRON-Flavor] error:', err.message);
  }
}

module.exports = refreshInventory;
