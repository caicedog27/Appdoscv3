/**
 * POST /auth/google/callback
 *
 * Flujo:
 * 1. Recibe el `code` de Google Identity Services (GIS) enviado por el
 *    frontend.
 * 2. Intercambia el código por tokens en oauth2.googleapis.com.
 * 3. Verifica el id_token y obtiene los datos del usuario.
 * 4. Busca o crea un documento en Firestore (/users/{uid}) con hasta
 *    10 roles (role, role1 … role10).
 * 5. Guarda usuario + roles en req.session.user.
 * 6. Devuelve JSON {redirect:"/"} para que el frontend navegue.
 */

require('dotenv').config();
const express = require('express');
const axios   = require('axios');
const { OAuth2Client } = require('google-auth-library');

const router = express.Router();

/* ─── Firebase Admin (Firestore) ──────────────────────────────────────── */
const admin = require('../config/firebaseAdmin');
const db    = admin.firestore();

/* ─── Entorno ─────────────────────────────────────────────────────────── */
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  BASE_URL                     // ej. http://localhost:3001
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !BASE_URL) {
  console.warn('⚠️  Faltan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o BASE_URL en .env');
}

const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/* ─── Helper: code ➜ tokens ───────────────────────────────────────────── */

async function exchangeCode(code) {

async function exchangeCode(code) {

  const params = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: 'postmessage',
    grant_type: 'authorization_code'
  });

  try {
    const { data } = await axios.post(
      'https://oauth2.googleapis.com/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return data; /* { id_token, access_token, refresh_token?, ... } */
  } catch (err) {
    console.error('Token exchange failed:', err.response?.data || err.message);
    throw new Error('token_exchange_failed');
  }
}


  const { data } = await axios.post(
    'https://oauth2.googleapis.com/token',
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return data; /* { id_token, access_token, refresh_token?, ... } */
}

/* ─── Main route ──────────────────────────────────────────────────────── */
router.post('/google/callback', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Falta code' });

    /* 1· Intercambiar code -> tokens */
    const { id_token } = await exchangeCode(code);

    /* 2· Verificar id_token */
    const ticket  = await oauthClient.verifyIdToken({
      idToken: id_token,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();  // sub, email, name, picture…
    const uid     = payload.sub;
    const email   = payload.email;

    /* 3· Firestore: obtener o crear documento de usuario */
    const userRef = db.collection('users').doc(uid);
    const snap    = await userRef.get();

    // Crear documento por defecto si no existe
    if (!snap.exists) {
      await userRef.set({ email, role: 'viewer' });  // rol principal
    }

    const userData = (await userRef.get()).data();

    /* 4· Extraer hasta 10 roles */
    const roles = {};
    for (let i = 0; i <= 10; i++) {
      const key = i === 0 ? 'role' : `role${i}`;
      roles[key] = userData[key] || null;
    }

    /* 5· Guardar en sesión */
    req.session.user = {
      uid,
      email,
      ...roles
    };

     /* 5.1· Registro en terminal */
      console.log(
         `✅ LOGIN OK  · uid=${uid} · email=${email} · role=${roles.role || '—'}`
      );

    /* 6· Responder JSON para que el frontend redirija */
    return res.json({
      redirect: '/',
      uid,
      email,
      ...roles
    });

  } catch (err) {
    console.error('Auth callback error:', err.response?.data || err.message);
    return res.status(401).json({
      error: 'auth_failed',
      details: err.message
    });
  }
});

module.exports = router;
