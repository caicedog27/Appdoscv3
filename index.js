/**
 * AppDocs ▸ Servidor Express + Firebase Admin
 * ------------------------------------------
 * 1) Lee variables de entorno.
 * 2) Monta las rutas EJS.
 * 3) Programa cron-jobs.
 * 4) Aplica UNA política CSP compatible con:
 *      · Firebase (gstatic)
 *      · Bootstrap (jsDelivr/unpkg)
 *      · Scripts/styling inline imprescindibles
 */

require('dotenv').config();

// ─── Dependencias ────────────────────────────────────────────────────────────
const express        = require('express');
const bodyParser     = require('body-parser');
const path           = require('path');
const session        = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const helmet         = require('helmet');
const rateLimit      = require('express-rate-limit');
const cron           = require('node-cron');

// ─── Cron-jobs ───────────────────────────────────────────────────────────────
const refreshPerlas  = require('./cron/inventorySyncPerlas');
const refreshPopping = require('./cron/inventorySyncPopping');
const refreshFlavor  = require('./cron/inventorySyncFlavor');

// ─── Firebase Admin ─────────────────────────────────────────────────────────
const admin          = require('firebase-admin');
const serviceAccount = require('./firebase-credentials.json');
const { checkAuth } = require('./src/middlewares/authMiddleware');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// ─── Express app ────────────────────────────────────────────────────────────
const app  = express();
const port = process.env.PORT || 3001;

// Vistas EJS con layout
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Archivos estáticos (CSS, imágenes, JS del frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Body-parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ─── Seguridad: Helmet + CSP única ──────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        /* ── FUENTES PRINCIPALES ───────────────────── */
        defaultSrc: ["'self'"],

        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://unpkg.com',
          'https://www.gstatic.com',
          'https://apis.google.com',
          'https://accounts.google.com'      // ⬅ SDK de Google Identity
        ],

        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://unpkg.com'
        ],

        imgSrc:  ["'self'", 'data:'],
        fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://unpkg.com'],

        /* ── FIREBASE AUTH DOMAINS ─────────────────── */
        frameSrc: [
          "'self'",
          'https://accounts.google.com',          // Google OAuth iframe
          'https://appdocs-c84f9.firebaseapp.com' // tu authDomain
        ],

        connectSrc: [
          "'self'",
          'https://identitytoolkit.googleapis.com',  // REST Auth
          'https://securetoken.googleapis.com',      // token refresh
          'https://www.googleapis.com',              // ocasionalmente usado
          'https://oauth2.googleapis.com'
        ]
      }


    },
  })
);

// Limitador de peticiones
app.use(rateLimit({ windowMs: 15 * 60 * 1e3, max: 100 }));

// Sesiones
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  })
);

// ─── Rutas ──────────────────────────────────────────────────────────────────
app.use('/purchase',    require('./src/routes/purchaseRoutes'));
app.use('/inventarios', require('./src/routes/inventoryRoutes'));
app.use('/perfil',      require('./src/routes/profileRoutes'));
app.use('/auth',        require('./src/routes/authRoutes'));

// ─── Cron schedulers ────────────────────────────────────────────────────────
refreshPerlas();
refreshPopping();
refreshFlavor();

cron.schedule('*/2 * * * *', () => {   // cada 2 min
  refreshPerlas();
  refreshPopping();
  refreshFlavor();
});

// ─── Endpoints básicos ──────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/', checkAuth, (req, res) => {
  res.render('index', {
    title: 'Dashboard Siigo-Firebase',
    companyName: 'Mi Empresa',
    user: req.session.user,
  });
});

app.get('/login', (_req, res) => {
  res.render('login', {
    title: 'Iniciar Sesión',
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    firebaseConfig: {
      apiKey:            process.env.FIREBASE_API_KEY,
      authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
      projectId:         process.env.FIREBASE_PROJECT_ID,
      storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId:             process.env.FIREBASE_APP_ID,
    },
    layout: false             //  ⟵  desactiva layout.ejs
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// 404
app.use((_req, res) =>
  res.status(404).render('404', { title: 'Página no encontrada' })
);

// ─── Arranque del servidor ─────────────────────────────────────────────────
app.listen(port, () =>
  console.log(`Servidor corriendo en http://localhost:${port}`)
);

// Exporta Firestore para módulos externos
module.exports = db;
