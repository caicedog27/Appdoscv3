/* ────────────────────────────────────────────────────────────────
   Servicio Siigo – Popping Boba International
   ----------------------------------------------------------------
   ▸ Mantiene TODAS las firmas que ya usaba tu app:
       authenticate, ensureAuthenticated, getProducts, getAllProducts,
       getTaxes, searchProviders, searchProducts
   ▸ Añade:
       • Caché de token (singleton) – sin logins duplicados
       • Bottleneck (1 req cada 350 ms) – evita 429
       • Reintento automático en 401 y 429
   ▸ No altera el JSON que devuelve Siigo.
   ────────────────────────────────────────────────────────────────*/

require('dotenv').config();
const axios      = require('axios');
const Bottleneck = require('bottleneck');

// Credenciales
const USERNAME   = process.env.POPPING_SIIGO_USER;
const ACCESS_KEY = process.env.POPPING_SIIGO_KEY;

// Endpoints
const BASE       = 'https://api.siigo.com';
const PARTNER_ID = process.env.POPPING_PARTNER_ID || 'TuAplicacionNodeJS';

if (!USERNAME || !ACCESS_KEY) {
  throw new Error('[SiigoPopping] Faltan POPPING_SIIGO_USER o POPPING_SIIGO_KEY en el entorno');
}

// Rate-limit local (≈170 req/min)
const limiter = new Bottleneck({ maxConcurrent: 1, minTime: 350 });

// ─────────────────── Token cache ───────────────────
let token      = null;
let tokenExpMs = 0;
let authPromise = null;

async function authenticate () {
  const { data } = await axios.post(
    `${BASE}/auth`,
    { username: USERNAME, access_key: ACCESS_KEY },
    { headers: { 'Partner-Id': PARTNER_ID } }
  );
  token      = data.access_token;
  tokenExpMs = Date.now() + data.expires_in * 1000;
  return token;
}

async function ensureAuthenticated () {
  if (token && Date.now() < tokenExpMs - 60_000) return token;   // válido
  if (authPromise) return authPromise;                           // otro hilo
  authPromise = authenticate();
  try { await authPromise; } finally { authPromise = null; }
  return token;
}

// ─────────────────── Cliente Axios ───────────────────
const api = axios.create({ baseURL: BASE });

api.interceptors.request.use(async cfg => {
  cfg.headers.Authorization = `Bearer ${await ensureAuthenticated()}`;
  cfg.headers['Partner-Id'] = PARTNER_ID;
  return cfg;
});

api.interceptors.response.use(null, async err => {
  const { response, config } = err;
  if (!response) throw err;

  // 401 => token expiró
  if (response.status === 401 && !config._retry401) {
    config._retry401 = true;
    token = null;
    await ensureAuthenticated();
    return api(config);
  }

  // 429 => rate-limit
  if (response.status === 429 && !config._retry429) {
    const wait = Number(response.headers['retry-after']) || 25;
    await new Promise(r => setTimeout(r, wait * 1000));
    config._retry429 = true;
    return api(config);
  }

  throw err;
});

// helper con Bottleneck
const req = (method, url) =>
  limiter.schedule(() => api({ method, url }));

// ─────────────────── Funciones públicas ───────────────────
async function getProducts (page = 1, pageSize = 100) {
  const { data } =
    await req('get', `/v1/products?page=${page}&page_size=${pageSize}`);
  return data;                       // JSON crudo
}

async function getAllProducts () {
  const first = await getProducts(1);
  if (!first.results) return [];

  const total     = first.pagination?.total_results || first.results.length;
  const pages     = Math.ceil(total / 100);
  const products  = [...first.results];

  for (let p = 2; p <= pages; p++) {
    const { results } = await getProducts(p);
    if (results) products.push(...results);
  }
  return products;
}

async function getTaxes () {
  const { data } = await req('get', '/v1/taxes');
  return data;
}

async function searchProviders (query) {
  const { data } = await req('get', '/v1/customers?page=1&page_size=100');
  const q = (query || '').toLowerCase();
  return (data.results || []).filter(c =>
    `${c.identification} ${(Array.isArray(c.name)?c.name.join(' '):c.name)} ${c.commercial_name}`
      .toLowerCase()
      .includes(q)
  );
}

async function searchProducts (query) {
  const { data } = await req('get', '/v1/products?page=1&page_size=100');
  const q = (query || '').toLowerCase();
  return (data.results || []).filter(p =>
    `${p.code} ${p.name}`.toLowerCase().includes(q)
  );
}

// ─────────────────── Exports ───────────────────
module.exports = {
  // autenticación
  authenticate,
  ensureAuthenticated,

  // consultas
  getProducts,
  getAllProducts,
  getTaxes,
  searchProviders,
  searchProducts
};
