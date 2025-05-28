/**
 * cron/inventorySyncPopping.js
 * ---------------------------------------------------------
 * Refresca cada 5 min el inventario de Popping
 *   -> clave cache: "poppingInventory"
 */
const cache        = require('../src/cache/inventoryCache');
const siigoService = require('../src/services/siigoServicePoping');

async function refreshInventory () {
  try {
    const data = await siigoService.getAllProducts();
    cache.set('poppingInventory', data);
    console.log('[CRON-Popping] inventario actualizado', new Date());
  } catch (err) {
    console.error('[CRON-Popping] error:', err.message);
  }
}

module.exports = refreshInventory;
