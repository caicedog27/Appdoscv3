// src/config/firebaseAdmin.js

const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, '../../firebase-credentials.json'));

// Inicializar SOLO UNA VEZ
if (!admin.apps.length) {  // check para evitar duplicados
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // databaseURL: "https://<tu-proyecto>.firebaseio.com",
  });
}

module.exports = admin;
