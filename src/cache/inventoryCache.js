const NodeCache = require('node-cache');   //  npm i node-cache
// TTL de 5 minutos para todas las entradas
module.exports   = new NodeCache({ stdTTL: 300 });
