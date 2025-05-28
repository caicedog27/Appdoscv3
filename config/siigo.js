/**
 * config/siigo.js
 * Configura TRES instancias del SDK de Siigo para 'popping', 'flavor' y 'perlas'.
 */
const siigo_api = require('siigo_api');

/**
 * Crea una nueva instancia de ApiClient para una conexión específica
 * @param {string} accessToken - Token de acceso de Siigo
 * @returns {ApiClient} - Instancia configurada de ApiClient
 */
function createSiigoClient(accessToken) {
  // NOTA: la librería `siigo_api` usualmente expone `ApiClient.instance` como singleton,
  // pero para manejar MÚLTIPLES conexiones, creamos "nuevas" instancias cuando sea posible.
  // Dependiendo la versión del SDK, podría variar la forma en que se inicializa.
  const client = new siigo_api.ApiClient(); 

  // Autenticación
  const oauth2 = client.authentications['OAuth2ClientCredentials'];
  oauth2.accessToken = accessToken;

  // Si necesitas setear una basePath diferente, descomenta y usa la variable de entorno:
  // client.basePath = process.env.SIIGO_BASE_URL || 'https://api.siigo.com/v1';

  return client;
}

// Instancias para cada "empresa" o cada conexión:
const poppingClient = createSiigoClient(process.env.SIIGO_POPPING_ACCESS_TOKEN);
const flavorClient  = createSiigoClient(process.env.SIIGO_FLAVOR_ACCESS_TOKEN);
const perlasClient  = createSiigoClient(process.env.SIIGO_PERLAS_ACCESS_TOKEN);

module.exports = {
  siigo_api,
  poppingClient,
  flavorClient,
  perlasClient,
};
