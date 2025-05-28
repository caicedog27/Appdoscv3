/* ────────────────────────────────────────────────────────────────
   Servicio Siigo – Group Flavol Solution Lab
   ----------------------------------------------------------------
   ▸ Mantiene TODAS las firmas públicas que usa tu aplicación:
       authenticate, ensureAuthenticated, getProducts, getAllProducts,
       getTaxes, searchProviders, searchProducts
   ▸ Token singleton + Bottleneck (rate-limit) + reintento 401/429
   ▸ Carga credenciales desde .env:
       FLAVOL_SIIGO_USER   FLAVOL_SIIGO_KEY
       (opcional) FLAVOL_PARTNER_ID FLAVOL_MIN_TIME FLAVOL_CONCURRENT
   ────────────────────────────────────────────────────────────────*/

require('dotenv').config();
const axios      = require('axios');
const Bottleneck = require('bottleneck');

// ──────────────── ENV ─────────────────
const {
  FLAVOL_SIIGO_USER: USERNAME,
  FLAVOL_SIIGO_KEY:  ACCESS_KEY,
  FLAVOL_PARTNER_ID  = 'TuAplicacionNodeJS',
  FLAVOL_MIN_TIME    = 350,   // ms entre peticiones
  FLAVOL_CONCURRENT  = 1
} = process.env;

if (!USERNAME || !ACCESS_KEY) {
  throw new Error('[SiigoFlavol] Faltan FLAVOL_SIIGO_USER o FLAVOL_SIIGO_KEY en .env');
}

// ──────────────── Constantes ──────────
const BASE      = 'https://api.siigo.com';
const PAGE_SIZE = 100;

// ──────────────── Rate-Limiter ────────
const limiter = new Bottleneck({
  maxConcurrent: Number(FLAVOL_CONCURRENT),
  minTime:       Number(FLAVOL_MIN_TIME)
});

// ──────────────── Token cache ─────────
let token = null, expMs = 0, authPromise = null;

async function authenticate () {
  const { data } = await axios.post(
    `${BASE}/auth`,
    { username: USERNAME, access_key: ACCESS_KEY },
    { headers: { 'Partner-Id': FLAVOL_PARTNER_ID } }
  );
  token  = data.access_token;
  expMs  = Date.now() + data.expires_in * 1000;
  return token;
}

async function ensureAuthenticated () {
  if (token && Date.now() < expMs - 60_000) return token;
  if (authPromise) return authPromise;
  authPromise = authenticate();
  try { await authPromise; } finally { authPromise = null; }
  return token;
}

// ──────────────── Axios cliente ──────
const api = axios.create({ baseURL: BASE });

api.interceptors.request.use(async cfg => {
  cfg.headers.Authorization = `Bearer ${await ensureAuthenticated()}`;
  cfg.headers['Partner-Id'] = FLAVOL_PARTNER_ID;
  return cfg;
});

api.interceptors.response.use(null, async err => {
  const { response, config } = err;
  if (!response) throw err;

  if (response.status === 401 && !config._retry401) {
    config._retry401 = true;
    token = null;
    await ensureAuthenticated();
    return api(config);
  }
  if (response.status === 429 && !config._retry429) {
    const wait = Number(response.headers['retry-after']) || 25;
    console.warn(`[SiigoFlavol] 429 – esperando ${wait}s …`);
    await new Promise(r => setTimeout(r, wait * 1000));
    config._retry429 = true;
    return api(config);
  }
  throw err;
});

// helper con Bottleneck
const req = (method, url) =>
  limiter.schedule(() => api({ method, url }));

// ──────────────── Funciones públicas ─────────────
async function getProducts (page = 1, pageSize = PAGE_SIZE) {
  const { data } =
    await req('get', `/v1/products?page=${page}&page_size=${pageSize}`);
  return data;                     // JSON crudo
}

async function getAllProducts () {
  const first = await getProducts(1);
  if (!first.results) return [];

  const total  = first.pagination?.total_results || first.results.length;
  const pages  = Math.ceil(total / PAGE_SIZE);
  const result = [...first.results];

  for (let p = 2; p <= pages; p++) {
    const { results } = await getProducts(p);
    if (results) result.push(...results);
  }
  return result;
}

async function getTaxes () {
  const { data } = await req('get', '/v1/taxes');
  return data;
}

async function searchProviders (query = '') {
  const { data } =
    await req('get', '/v1/customers?page=1&page_size=100');
  const q = query.toLowerCase();
  return (data.results || []).filter(c =>
    `${c.identification} ${(Array.isArray(c.name)?c.name.join(' '):c.name)} ${c.commercial_name}`
      .toLowerCase()
      .includes(q)
  );
}

async function searchProducts (query = '') {
  const { data } =
    await req('get', '/v1/products?page=1&page_size=100');
  const q = query.toLowerCase();
  return (data.results || []).filter(p =>
    `${p.code} ${p.name}`.toLowerCase().includes(q)
  );
}

// ──────────────── Exporta ─────────────
module.exports = {
  authenticate,
  ensureAuthenticated,
  getProducts,
  getAllProducts,
  getTaxes,
  searchProviders,
  searchProducts
};
