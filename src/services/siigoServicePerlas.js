// Servicio Siigo – empresa Perlas-Explosivas
const axios      = require('axios');
const Bottleneck = require('bottleneck');

require('dotenv').config();
const USERNAME   = process.env.PERLAS_SIIGO_USER;
const ACCESS_KEY = process.env.PERLAS_SIIGO_KEY;
const PARTNER_ID = process.env.PERLAS_PARTNER_ID || 'TuAplicacionNodeJS';

if (!USERNAME || !ACCESS_KEY) {
  throw new Error('[SiigoPerlas] Faltan PERLAS_SIIGO_USER o PERLAS_SIIGO_KEY en el entorno');
}
const BASE       = 'https://api.siigo.com';
const PAGE_SIZE  = 100;

const limiter = new Bottleneck({ maxConcurrent: 1, minTime: 350 });

let token = null, exp = 0, authPromise = null;

async function login () {
  const { data } = await axios.post(
    `${BASE}/auth`,
    { username: USERNAME, access_key: ACCESS_KEY },
    { headers: { 'Partner-Id': PARTNER_ID } }
  );
  token = data.access_token;
  exp   = Date.now() + data.expires_in * 1000;
  return token;
}
async function ensureAuthenticated () {
  if (token && Date.now() < exp - 60_000) return token;
  if (authPromise) return authPromise;
  authPromise = login();
  try { await authPromise; } finally { authPromise = null; }
  return token;
}

const api = axios.create({ baseURL: BASE });
api.interceptors.request.use(async cfg => {
  cfg.headers.Authorization = `Bearer ${await ensureAuthenticated()}`;
  cfg.headers['Partner-Id'] = PARTNER_ID;
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
    await new Promise(r => setTimeout(r, wait * 1000));
    config._retry429 = true;
    return api(config);
  }
  throw err;
});

const req = (method, url) =>
  limiter.schedule(() => api({ method, url }));

async function getProducts (page = 1, size = PAGE_SIZE) {
  const { data } = await req('get', `/v1/products?page=${page}&page_size=${size}`);
  return data;
}
async function getAllProducts () {
  const first = await getProducts(1);
  if (!first.results) return [];
  const total = first.pagination?.total_results || first.results.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const all = [...first.results];
  for (let p = 2; p <= totalPages; p++) {
    const r = await getProducts(p);
    if (r.results) all.push(...r.results);
  }
  return all;
}
async function searchProducts (q) {
  const pageOne = await getProducts(1);
  const k = (q || '').toLowerCase();
  return (pageOne.results || []).filter(x =>
    (`${x.code} ${x.name}`.toLowerCase().includes(k)));
}

module.exports = {
  authenticate:        ensureAuthenticated,
  ensureAuthenticated,
  getProducts,
  getAllProducts,
  searchProducts
};
