/**
 * siigoHelper.js
 * Maneja la asignación dinámica del accessToken
 */
require('dotenv').config(); // Asegúrate de cargar las variables de entorno
const siigo_api = require('siigo_api');

// Opcional, si requieres fijar la basePath. Descomenta si te hace falta.
// siigo_api.ApiClient.instance.basePath = process.env.SIIGO_BASE_URL || 'https://api.siigo.com/v1';

/**
 * Cambia el token del ApiClient singleton a uno específico (popping, flavor o perlas)
 * @param {string} company - 'popping' | 'flavor' | 'perlas'
 */
function setSiigoToken(company) {
  const defaultClient = siigo_api.ApiClient.instance;
  const oauth2 = defaultClient.authentications['OAuth2ClientCredentials'];

  switch (company) {
    case 'popping':
      oauth2.accessToken = process.env.SIIGO_POPPING_ACCESS_TOKEN;
      break;
    case 'flavor':
      oauth2.accessToken = process.env.SIIGO_FLAVOR_ACCESS_TOKEN;
      break;
    case 'perlas':
      oauth2.accessToken = process.env.SIIGO_PERLAS_ACCESS_TOKEN;
      break;
    default:
      throw new Error(`Company desconocida: ${company}`);
  }
}

module.exports = {
  siigo_api,
  setSiigoToken
};
