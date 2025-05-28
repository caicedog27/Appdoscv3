// src/config/firebaseAdmin.js

const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, '../../firebase-credentials.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // databaseURL: ...
  });
}

module.exports = admin;
