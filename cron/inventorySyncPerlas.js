/**
 * cron/inventorySyncPerlas.js
 * ---------------------------------------------------------
 * Refresca cada 5 min el inventario de Perlas
 *   -> clave cache: "perlasInventory"
 */
const cache        = require('../src/cache/inventoryCache');
const siigoService = require('../src/services/siigoServicePerlas');

async function refreshInventory () {
  try {
    const data = await siigoService.getAllProducts();
    cache.set('perlasInventory', data);          // TTL acorde a tu Node-Cache
    console.log('[CRON-Perlas] inventario actualizado', new Date());
  } catch (err) {
    console.error('[CRON-Perlas] error:', err.message);
  }
}

module.exports = refreshInventory;
