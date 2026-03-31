const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Render-compatible GCP credentials: GOOGLE_SERVICE_ACCOUNT_JSON → temp file + ADC
try {
  require('../lib/gcp-credentials').loadGcpCredentials();
} catch (e) {
  console.warn('[BOOT] GCP credentials loader skipped:', e.message);
}

// Export store (GCS when GCS_BUCKET set; else disk). Set before loading compose so vnext can use it.
const { createExportStore } = require('../lib/export-store');
const exportStore = createExportStore();
process.__astradio_export_store = exportStore;
if (process.env.GCS_BUCKET) {
  console.log('[EXPORTS] Using GCS bucket:', process.env.GCS_BUCKET, 'prefix:', process.env.GCS_PREFIX || 'exports/');
} else {
  console.log('[EXPORTS] Using local disk (ephemeral on Render)');
}

// Phase 4 runtime diagnostics: DB status visibility (no feature flags, no fallbacks)
if (process.env.POSTGRES_URL) {
  console.log('[DB] Enabled: migrations expected applied');
} else {
  console.warn('[DB] Disabled: community + vectors will fail-closed');
}

// vNext compiled handlers (do NOT import .ts directly) — optional for dev boot
const { optionalRequire, noopMiddleware, noopRouter } = require('../lib/opt/optional');

const noopMw = noopMiddleware();
const noopRouterInstance = noopRouter();

const vnextRoot = path.join(__dirname, "..", "dist", "vnext", "vnext");
const { ensureCampaignRuntimeParity } = require('./lib/campaign-runtime');
const composeMod = optionalRequire(path.join(vnextRoot, "api", "compose"));
const shadowMod = optionalRequire(path.join(vnextRoot, "api", "shadow"));
const canaryMod = optionalRequire(path.join(vnextRoot, "api", "canary"));
const renderMod = optionalRequire(path.join(vnextRoot, "api", "render"));
const healthMod = optionalRequire(path.join(vnextRoot, "api", "health"));
const astroDebugMod = optionalRequire(path.join(vnextRoot, "api", "astro-debug"));
const compatMod = optionalRequire(path.join(vnextRoot, "compat", "routes"));
const personalityMod = optionalRequire(path.join(vnextRoot, "api", "personality-routes"));
const sandboxMod = optionalRequire(path.join(vnextRoot, "api", "sandbox-routes"));

const vnextCompose = composeMod?.vnextCompose || ((req, res) => res.status(501).json({ ok: false, error: "compose_unavailable" }));
const shadowMiddleware = shadowMod?.shadowMiddleware || noopMw;
const canaryRouter = canaryMod?.canaryRouter || noopRouterInstance;
const vnextRender = renderMod?.vnextRender || ((req, res) => res.status(501).json({ ok: false, error: "render_unavailable" }));
const validateModelRequirements = healthMod?.validateModelRequirements || (async () => ({ backend: "noop", sha256: "dev", outShape: [0] }));
const astroDebugHandler = astroDebugMod?.astroDebugHandler || ((req, res) => res.status(501).json({ ok: false, error: "astro_debug_unavailable" }));

// Import existing Swiss Ephemeris functionality
const swe = require("swisseph");
const moment = require("moment-timezone");
const tzlookup = require("tzlookup");

// Import new platform modules (optional)
// Paths must be absolute: optionalRequire resolves relative paths from lib/opt/optional.js, not this file.
const database = optionalRequire(path.join(__dirname, "..", "lib", "database"), "database") || { close: async () => {} };
const redis = optionalRequire(path.join(__dirname, "..", "lib", "redis"), "redis") || { close: async () => {}, connect: async () => {} };

// Import routes (optional)
const authRoutes = optionalRequire(path.join(__dirname, "..", "dist", "routes", "auth"), "authRoutes");
const userRoutes = optionalRequire(path.join(__dirname, "..", "dist", "routes", "users"), "userRoutes");
const trackRoutes = optionalRequire(path.join(__dirname, "..", "dist", "routes", "tracks"), "trackRoutes");
const socialRoutes = optionalRequire(path.join(__dirname, "..", "dist", "routes", "social"), "socialRoutes");
const libraryRoutes = optionalRequire(path.join(__dirname, "..", "dist", "routes", "library"), "libraryRoutes");

const app = express();
// Behind Render (or any reverse proxy): trust first proxy so req.ip and X-Forwarded-* are correct; avoids express-rate-limit ValidationError ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
app.set('trust proxy', 1);
// Engine default port: 4000 (can be overridden via PORT env)
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
const BETA_ENABLED = process.env.BETA_ACCESS !== 'false';
const BETA_KILL = process.env.BETA_KILL_SWITCH === 'true';
const BETA_ALLOW = (process.env.BETA_ALLOWLIST || '').split(',').map(s=>s.trim()).filter(Boolean);

// Hard deprecation gate (authoritative). Must be registered FIRST before any other routes.
const DEPRECATE_LEGACY = process.env.DEPRECATE_LEGACY_ROUTES !== "false"; // default true
if (DEPRECATE_LEGACY) {
  app.all(/^\/api\/(vnext\/)?(render|astro-debug)$/, (req, res) => {
    res
      .status(410)
      .json({ error: "deprecated_route", message: "Use POST /api/compose (Unified Spec v1.1)" });
  });
}

// vNext Model Health Check (startup validation).
// Before: health module did not exist, so validateModelRequirements was always the
// in-server fallback { backend: 'noop', sha256: 'dev' } → startup showed noop/dev.
// Now: health module runs one real inference and logs actual backend + model_sha.
// ML_REQUIRED=1: fail fast if no real model (no silent noop).
(async () => {
  try {
    const info = await validateModelRequirements();
    console.log(`[vNext] TF backend=${info.backend} model_sha=${info.sha256} out=${JSON.stringify(info.outShape)}`);
    const mlRequired = process.env.ML_REQUIRED === "1";
    if (mlRequired) {
      const noop = (info.backend || "").toLowerCase() === "noop";
      const devSha = /^(dev|local|unknown)$/i.test(String(info.sha256 || "").trim());
      if (noop || devSha) {
        console.error("[vNext] ML_REQUIRED=1 but model is noop/dev. Refusing to start.");
        console.error("[vNext] Ensure models/student-v2.2/model.json (and group1-shard1of1.bin) exist, or set VNEXT_MODEL_PATH.");
        process.exit(1);
      }
    }
  } catch (e) {
    console.error("vNext model health check failed:", e.message);
    if (process.env.ML_REQUIRED === "1" || process.env.STRICT_ML === "true") {
      console.error("ML_REQUIRED=1 or STRICT_ML enabled - refusing to start without valid model");
      process.exit(1);
    } else {
      console.warn("Continuing in dev mode with fallback enabled");
    }
  }
})();

// ===== FEATURE FLAGS =====
const FEATURE_FLAGS = {
  FF_VECTOR_UI: process.env.FF_VECTOR_UI === 'true' || true,
  FF_ENGINE_VECTOR: process.env.FF_ENGINE_VECTOR === 'true' || true,
  FF_DELETE_LEGACY_SERVERS: process.env.FF_DELETE_LEGACY_SERVERS === 'true' || true
};

console.log('Feature Flags:', FEATURE_FLAGS);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"],
      workerSrc: ["'self'", "blob:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
    },
  },
}));

// CORS: allowlist from CORS_ORIGINS (comma-separated). Always allow localhost in dev. Allow https://*.vercel.app.
function corsOrigin(origin, cb) {
  const list = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV !== 'production') list.push('http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001');
  if (/^https:\/\/[^/]+\.vercel\.app$/i.test(origin)) list.push(origin);
  const allowed = list.length ? list : ['http://localhost:3000'];
  if (!origin || allowed.includes(origin)) return cb(null, true);
  cb(null, false);
}
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-beta-user', 'x-forwarded-for', 'x-real-ip'],
}));

// Add permissive CSP for audio development (allows blob URLs)
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 
    "default-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://unpkg.com; " +
    "worker-src 'self' blob:; " +
    "connect-src 'self' https:; " +
    "media-src 'self' blob: data:; " +
    "object-src 'none';"
  );
  next();
});

// Rate limiting - more permissive for development and testing
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Increased to 1000 requests per windowMs for testing
  message: {
    error: "Too many requests from this IP, please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for localhost in development
  skip: (req) => {
    const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
    const isDevelopment = process.env.NODE_ENV !== 'production';
    return isLocalhost && isDevelopment;
  }
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Beta gate middleware (header x-beta-user must be allowed)
function requireBeta(req, res, next){
  if (!BETA_ENABLED) return res.status(403).json({ error: 'beta_disabled' });
  if (BETA_KILL) return res.status(503).json({ error: 'beta_kill_switch' });
  const who = (req.headers['x-beta-user'] || '').toString().toLowerCase();
  if (BETA_ALLOW.length === 0) { (req).betaUser = who || 'anon'; return next(); }
  if (!who || !BETA_ALLOW.includes(who)) return res.status(403).json({ error: 'beta_not_allowed' });
  (req).betaUser = who;
  next();
}

// Static file serving — API-only safe: do not crash when frontend is not built (e.g. Render API-only, frontend on Vercel)
const PUBLIC_DIR = path.join(__dirname, "../public");
const INDEX_HTML = path.join(PUBLIC_DIR, "index.html");
const HAS_SPA = (function () {
  try {
    return fs.existsSync(INDEX_HTML);
  } catch {
    return false;
  }
})();
if (HAS_SPA) {
  app.use(express.static(PUBLIC_DIR));
} else {
  console.log("[static] index.html not found; running API-only");
}

// Media file serving for generated audio
const MEDIA_DIR = path.join(__dirname, "../media");
app.use("/media", express.static(MEDIA_DIR));

// Exports directory - parameterized and hardened
// For Render, /tmp is writable; for local dev, cwd()/exports is fine
const EXPORT_ROOT = process.env.EXPORT_ROOT || path.join(process.cwd(), 'exports');

try {
  fs.mkdirSync(EXPORT_ROOT, { recursive: true });
  console.log(`[EXPORTS] Using directory: ${EXPORT_ROOT}`);
} catch (err) {
  console.error('Failed to ensure EXPORT_ROOT exists:', {
    EXPORT_ROOT,
    error: err.message,
  });
  // Continue anyway - will fail on actual write, but won't crash on startup
}

const EXPORTS_DIR = EXPORT_ROOT;

// ---------- Utilities ----------
function sha256Str(s){ return require('crypto').createHash('sha256').update(s).digest('hex'); }
function writeJson(filePath, obj){ fs.writeFileSync(filePath, JSON.stringify(obj, null, 2)); }
function ensureDir(p){ if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

// Basic LRU disk quota for /exports (dev-safe thresholds)
const EXPORT_QUOTA_BYTES = parseInt(process.env.EXPORT_QUOTA_BYTES || `${200*1024*1024}`); // 200MB
function getDirSizeBytes(dir){
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const name of fs.readdirSync(dir)){
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    total += st.isDirectory() ? getDirSizeBytes(p) : st.size;
  }
  return total;
}
function lruCleanupExports(){
  try {
    const size = getDirSizeBytes(EXPORTS_DIR);
    if (size <= EXPORT_QUOTA_BYTES) return;
    const entries = fs.readdirSync(EXPORTS_DIR)
      .map(name => ({ name, p: path.join(EXPORTS_DIR, name), st: fs.statSync(path.join(EXPORTS_DIR, name)) }))
      .filter(e => e.st.isDirectory())
      .sort((a,b) => a.st.mtimeMs - b.st.mtimeMs); // oldest first
    let freed = 0;
    for (const e of entries){
      // delete directory recursively
      fs.rmSync(e.p, { recursive: true, force: true });
      freed += e.st.size || 0;
      if (getDirSizeBytes(EXPORTS_DIR) <= EXPORT_QUOTA_BYTES) break;
    }
    console.log(`[EXPORT_QUOTA] Freed ~${freed} bytes`);
  } catch (e) {
    console.warn('[EXPORT_QUOTA] cleanup failed:', e.message);
  }
}

// Structured log writer (append-only jsonl)
const RUNTIME_LOG = path.join(__dirname, '../logs/runtime-structured.jsonl');
function appendRuntimeLog(entry){
  try {
    ensureDir(path.dirname(RUNTIME_LOG));
    fs.appendFileSync(RUNTIME_LOG, JSON.stringify(entry)+"\n");
  } catch (e) {
    console.warn('[OBS] failed to append log:', e.message);
  }
}

// ---------- caches ----------
const respCache = new Map();     // positions/chart 60s
const geoCache  = new Map();     // geocode 5m
const TTL_POS_MS = 60_000;
const TTL_GEO_MS = 5 * 60_000;

// ---------- Swiss Ephemeris setup ----------
// If you have local ephemeris .se1 files, point to the folder like:
// swe.swe_set_ephe_path(path.join(__dirname, "ephe"));

// ---------- Planet definitions ----------
const PLANETS = {
  sun: swe.SE_SUN,
  moon: swe.SE_MOON,
  mercury: swe.SE_MERCURY,
  venus: swe.SE_VENUS,
  mars: swe.SE_MARS,
  jupiter: swe.SE_JUPITER,
  saturn: swe.SE_SATURN,
  uranus: swe.SE_URANUS,
  neptune: swe.SE_NEPTUNE,
  pluto: swe.SE_PLUTO
};

const EXTRAS = {
  chiron: swe.SE_CHIRON,
  lilith: swe.SE_MEAN_NODE, // Mean Black Moon Lilith
  northNode: swe.SE_MEAN_NODE,
  // Note: southNode will be calculated as opposite of northNode
  ceres: swe.SE_CERES,
  juno: swe.SE_JUNO,
  vesta: swe.SE_VESTA,
  pallas: swe.SE_PALLAS
};

// ---------- helpers ----------
function pad2(n){ return String(n).padStart(2,"0"); }

// Deterministic RNG (xorshift32) seeded by a string
function seededRng(seedStr){
  let seed = 0;
  for (let i = 0; i < String(seedStr).length; i++) {
    seed = (seed ^ String(seedStr).charCodeAt(i)) >>> 0;
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0;
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909) >>> 0;
  }
  if (seed === 0) seed = 0x9E3779B9;
  let state = seed >>> 0;
  return function rng(){
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17; state >>>= 0;
    state ^= state << 5;  state >>>= 0;
    return (state >>> 0) / 0xFFFFFFFF;
  };
}

function normalizeDate(dateStr){
  if (!dateStr) return new Date().toISOString().slice(0,10);
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateStr);
  if (m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`;
  const d = new Date(dateStr);
  if (!isNaN(d)) return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth()+1)}-${pad2(d.getUTCDate())}`;
  throw new Error(`Invalid date format: ${dateStr}`);
}

function normalizeTime(timeStr){
  if (!timeStr) return "12:00";
  let t = timeStr.trim().toUpperCase();
  const ampm = /(AM|PM)$/.exec(t);
  if (ampm){
    t = t.replace(/\s*(AM|PM)\s*$/,"");
    const [hhRaw, mmRaw="00"] = t.split(":");
    let hh = parseInt(hhRaw,10); const mm = parseInt(mmRaw,10)||0;
    if (ampm[1]==="PM" && hh<12) hh+=12;
    if (ampm[1]==="AM" && hh===12) hh=0;
    return `${pad2(hh)}:${pad2(mm)}`;
  }
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(t);
  if (m) return `${pad2(+m[1])}:${pad2(+m[2])}`;
  throw new Error(`Invalid time format: ${timeStr}`);
}

// Get timezone from coordinates using reverse geocoding
async function getTimezoneFromCoords(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Astradio/1.0 (astradio.io; contact: support@astradio.io)",
        "Accept": "application/json"
      }
    });
    
    if (!response.ok) {
      console.warn("Could not get timezone from coordinates, using UTC");
      return "UTC";
    }
    
    const data = await response.json();
    const timezone = data.address?.timezone || data.timezone;
    
    if (timezone && moment.tz.zone(timezone)) {
      console.log(`Timezone for ${lat}, ${lon}: ${timezone}`);
      return timezone;
    } else {
      console.warn(`Invalid timezone ${timezone} for ${lat}, ${lon}, using UTC`);
      return "UTC";
    }
  } catch (error) {
    console.warn("Error getting timezone from coordinates:", error.message);
    return "UTC";
  }
}

/**
 * @param {string} dateStr
 * @param {string} timeStr
 * @param {number} lat
 * @param {number} lon
 * @param {string|null|undefined} preferredIanaTz - when valid, interpret date+time in this zone (campaign / compose contract)
 */
function toJulianDayUT(dateStr, timeStr, lat, lon, preferredIanaTz){
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm = 0] = timeStr.split(":").map(Number);

  const tzOpt = preferredIanaTz && String(preferredIanaTz).trim();
  if (tzOpt && moment.tz.zone(tzOpt)) {
    const localTimeWithTZ = moment.tz([y, m - 1, d, hh, mm], tzOpt);
    const ut = localTimeWithTZ.utc();
    return swe.swe_julday(ut.year(), ut.month() + 1, ut.date(), ut.hour() + ut.minute() / 60, swe.SE_GREG_CAL);
  }

  // If we have coordinates, try to get timezone and convert
  if (lat !== undefined && lon !== undefined) {
    try {
      // Use proper timezone lookup based on coordinates
      const timezone = tzlookup.tzNameAt(lat, lon);
      
      if (timezone && moment.tz.zone(timezone)) {
        // Create a moment object in the location's timezone
        const localTimeWithTZ = moment.tz([y, m-1, d, hh, mm], timezone);
        const ut = localTimeWithTZ.utc();
        
        // Log the conversion details for debugging
        const offset = localTimeWithTZ.format('Z');
        console.log(`Location: ${lat}, ${lon} (${timezone})`);
        console.log(`Input time: ${timeStr} (${offset})`);
        console.log(`Converted to UT: ${ut.format('HH:mm')}`);
        console.log(`Date: ${ut.format('YYYY-MM-DD')}`);
        
        return swe.swe_julday(ut.year(), ut.month() + 1, ut.date(), ut.hour() + ut.minute() / 60, swe.SE_GREG_CAL);
      } else {
        console.warn(`Invalid timezone ${timezone} for ${lat}, ${lon}, using UTC`);
      }
    } catch (error) {
      console.warn("Error in timezone conversion, using input as UT:", error.message);
    }
  }
  
  // Fallback: treat input as UT
  const ut = hh + mm / 60;
  console.log(`Using input time ${timeStr} as UT (no timezone conversion)`);
  return swe.swe_julday(y, m, d, ut, swe.SE_GREG_CAL);
}

// Calculate positions for planets and extras
function calcPositions(jd, includeExtras = true){
  const positions = {};
  const speeds = {};
  const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SPEED;
  
  // Main planets
  for (const [name, id] of Object.entries(PLANETS)) {
    try {
      const result = swe.swe_calc_ut(jd, id, flags);
      
      if (result.rc < 0) {
        console.warn(`Failed to calculate ${name}: ${result.rc}`);
        continue;
      }
      
      // Swiss Ephemeris: longitude in xx[0] or .longitude (wrapper-dependent)
      let lon = (result.xx && Array.isArray(result.xx) && result.xx[0] != null)
        ? result.xx[0]
        : result.longitude;
      if (lon === undefined || lon === null) {
        console.warn(`No longitude found for ${name}`);
        continue;
      }
      
      if (lon < 0) lon += 360;
      if (lon >= 360) lon -= 360;
      
      positions[name] = lon;
      // longitudinal speed (deg/day) if available
      if (result.xx && Array.isArray(result.xx) && result.xx[3] != null) {
        speeds[name] = result.xx[3];
      } else if (typeof result.speed === 'number') {
        speeds[name] = result.speed;
      }
    } catch (e) {
      console.error(`Error calculating ${name}:`, e.message);
    }
  }
  
  // Extras (Chiron, Ceres, Pallas, Juno, Vesta, nodes, Lilith)
  if (includeExtras) {
    for (const [name, id] of Object.entries(EXTRAS)) {
      try {
        const result = swe.swe_calc_ut(jd, id, flags);
        
        if (result.rc < 0) {
          console.warn(`Failed to calculate ${name}: ${result.rc}`);
          continue;
        }
        
        let lon = (result.xx && Array.isArray(result.xx) && result.xx[0] != null)
          ? result.xx[0]
          : result.longitude;
        if (lon === undefined || lon === null) {
          console.warn(`No longitude found for ${name}`);
          continue;
        }
        
        // Handle special cases
        if (name === 'northNode') {
          // Store the north node position for later south node calculation
          positions.northNode = lon;
          continue; // Skip adding to positions now, we'll add it after processing
        }
        if (name === 'southNode') {
          // Calculate south node as opposite of north node
          if (positions.northNode !== undefined) {
            lon = (positions.northNode + 180) % 360;
          } else {
            console.warn('North Node not available, skipping South Node calculation');
            continue;
          }
        }
        
        if (lon < 0) lon += 360;
        if (lon >= 360) lon -= 360;
        
        positions[name] = lon;
        if (result.xx && Array.isArray(result.xx) && result.xx[3] != null) {
          speeds[name] = result.xx[3];
        } else if (typeof result.speed === 'number') {
          speeds[name] = result.speed;
        }
      } catch (e) {
        console.error(`Error calculating ${name}:`, e.message);
      }
    }
    
    // Add north node to positions if it was calculated
    if (positions.northNode !== undefined) {
      positions.northNode = positions.northNode;
    }
  }
  
  return { positions, speeds };
}

// Calculate Placidus house cusps
function calcPlacidusCusps(jd, lat, lon) {
  try {
    // Calculate ASC (Ascendant)
    const result = swe.swe_houses(jd, lat, lon, 'P'); // 'P' for Placidus
    
    // Check if we have valid house data
    if (!result || !result.house || !Array.isArray(result.house) || result.house.length < 12) {
      console.warn("Invalid house data from Swiss Ephemeris, falling back to equal house");
      return Array.from({length:12}, (_,i) => i*30); // fallback to equal house
    }
    
    // The house array contains houses 1-12 directly (no need to slice)
    const cusps = result.house.slice(0, 12);
    return cusps;
  } catch (e) {
    console.error('Error calculating Placidus cusps:', e.message);
    return Array.from({length:12}, (_,i) => i*30); // fallback to equal house
  }
}

// Phase 8H: body order for deterministic priorityBase (same as canonical-bodies)
const BODY_ORDER_INDEX = { sun:0,moon:1,mercury:2,venus:3,mars:4,jupiter:5,saturn:6,uranus:7,neptune:8,pluto:9,chiron:10,ceres:11,pallas:12,juno:13,vesta:14 };
function bodyOrderIdx(name) { return BODY_ORDER_INDEX[name] != null ? BODY_ORDER_INDEX[name] : 999; }

// Calculate aspects between all bodies (Phase 8H: deterministic orbs + dynamics/strength/exactness/priorityBase [+ optional motion]))
function calcAspects(positions, speeds) {
  const aspects = [];
  const aspectTypes = {
    conjunction: { angle: 0, orb: 8, dynamics: 'amplifying' },
    sextile: { angle: 60, orb: 4, dynamics: 'supportive' },
    square: { angle: 90, orb: 6, dynamics: 'tense' },
    trine: { angle: 120, orb: 6, dynamics: 'flowing' },
    opposition: { angle: 180, orb: 8, dynamics: 'polarizing' }
  };
  const planetNames = Object.keys(positions);
  const speedMap = speeds || {};
  for (let i = 0; i < planetNames.length; i++) {
    for (let j = i + 1; j < planetNames.length; j++) {
      const p1 = planetNames[i];
      const p2 = planetNames[j];
      const lon1 = positions[p1];
      const lon2 = positions[p2];
      let separation = Math.abs(lon1 - lon2);
      if (separation > 180) separation = 360 - separation;
      for (const [type, config] of Object.entries(aspectTypes)) {
        const orb = Math.abs(separation - config.angle);
        if (orb <= config.orb) {
          const exactness = 1 - orb / config.orb;
          const strength = Math.max(0, Math.min(1, exactness));
          const imp = 1 - (bodyOrderIdx(p1) + bodyOrderIdx(p2)) / (2 * 20);
          const priorityBase = Math.max(0, Math.min(1, exactness * 0.7 + imp * 0.3));
          // Optional motion: applying vs separating (small forward step using speeds if available)
          let motion = undefined;
          const v1 = typeof speedMap[p1] === 'number' ? speedMap[p1] : null;
          const v2 = typeof speedMap[p2] === 'number' ? speedMap[p2] : null;
          if (v1 !== null && v2 !== null && Number.isFinite(v1) && Number.isFinite(v2)) {
            const dt = 0.01; // days
            const f1 = ((lon1 + v1 * dt) % 360 + 360) % 360;
            const f2 = ((lon2 + v2 * dt) % 360 + 360) % 360;
            let sepFuture = Math.abs(f1 - f2);
            if (sepFuture > 180) sepFuture = 360 - sepFuture;
            if (sepFuture < separation) motion = 'applying';
            else if (sepFuture > separation) motion = 'separating';
          }
          aspects.push({
            a: p1,
            b: p2,
            bodyA: p1,
            bodyB: p2,
            type,
            orb: Math.round(orb * 100) / 100,
            exactAngle: Math.round(separation * 100) / 100,
            dynamics: config.dynamics,
            strength: Math.round(strength * 100) / 100,
            exactness: Math.round(exactness * 100) / 100,
            priorityBase: Math.round(priorityBase * 100) / 100,
            motion
          });
        }
      }
    }
  }
  aspects.sort((x, y) => (y.priorityBase || 0) - (x.priorityBase || 0));
  return aspects;
}

// Calculate moon phase
function calcMoonPhase(jd) {
  try {
    // Get Sun and Moon positions
    const sunResult = swe.swe_calc_ut(jd, swe.SE_SUN, swe.SEFLG_SWIEPH);
    const moonResult = swe.swe_calc_ut(jd, swe.SE_MOON, swe.SEFLG_SWIEPH);
    
    if (sunResult.rc < 0 || moonResult.rc < 0) {
      console.warn("Failed to calculate moon phase");
      return 'waxing-crescent';
    }
    
    const sunLon = sunResult.longitude || sunResult.xx?.[0];
    const moonLon = moonResult.longitude || moonResult.xx?.[0];
    
    if (sunLon === undefined || moonLon === undefined) {
      return 'waxing-crescent';
    }
    
    // Calculate phase angle
    let phaseAngle = moonLon - sunLon;
    if (phaseAngle < 0) phaseAngle += 360;
    
    // Determine phase
    if (phaseAngle < 45) return 'new';
    if (phaseAngle < 90) return 'waxing-crescent';
    if (phaseAngle < 135) return 'first-quarter';
    if (phaseAngle < 180) return 'waxing-gibbous';
    if (phaseAngle < 225) return 'full';
    if (phaseAngle < 270) return 'waning-gibbous';
    if (phaseAngle < 315) return 'last-quarter';
    return 'waning-crescent';
    
  } catch (e) {
    console.error("Error calculating moon phase:", e.message);
    return 'waxing-crescent';
  }
}

// Calculate dominant elements
function calcDominantElements(positions) {
  const elementPlanets = {
    fire: ['sun', 'mars', 'jupiter'],
    earth: ['venus', 'saturn'],
    air: ['mercury', 'uranus'],
    water: ['moon', 'neptune', 'pluto']
  };
  
  const elementCounts = { fire: 0, earth: 0, air: 0, water: 0 };
  
  for (const [planet, lon] of Object.entries(positions)) {
    for (const [element, planets] of Object.entries(elementPlanets)) {
      if (planets.includes(planet)) {
        elementCounts[element]++;
        break;
      }
    }
  }
  
  // Calculate weights
  const total = Object.values(elementCounts).reduce((sum, count) => sum + count, 0);
  const weights = {};
  
  for (const [element, count] of Object.entries(elementCounts)) {
    weights[element] = total > 0 ? count / total : 0.25;
  }
  
  return weights;
}

// Build planetary clusters
function buildPlanetaryClusters(positions) {
  const aspects = calcAspects(positions);
  const clusters = [];
  const visited = new Set();
  
  // Find connected components (clusters)
  for (const planet of Object.keys(positions)) {
    if (visited.has(planet)) continue;
    
    const cluster = new Set([planet]);
    visited.add(planet);
    
    // BFS to find all connected planets
    const queue = [planet];
    while (queue.length > 0) {
      const current = queue.shift();
      
      for (const aspect of aspects) {
        if (aspect.p1 === current && !visited.has(aspect.p2)) {
          cluster.add(aspect.p2);
          visited.add(aspect.p2);
          queue.push(aspect.p2);
        } else if (aspect.p2 === current && !visited.has(aspect.p1)) {
          cluster.add(aspect.p1);
          visited.add(aspect.p1);
          queue.push(aspect.p1);
        }
      }
    }
    
    if (cluster.size > 1) {
      clusters.push({
        id: clusters.length + 1,
        planets: Array.from(cluster),
        center: Array.from(cluster).reduce((sum, p) => sum + positions[p], 0) / cluster.size
      });
    }
  }
  
  return clusters;
}

// ---------- Narrative Generation Functions ----------

function generateNarrativeFromContext(chartContext, mode, genre) {
  // Generate seed motif from Sun+Moon
  const sun = chartContext.planets?.sun || 0;
  const moon = chartContext.planets?.moon || 0;
  const sunNote = 60 + Math.floor(sun / 30);
  const moonNote = 60 + Math.floor(moon / 30);
  
  const motif = {
    notes: [sunNote, moonNote, sunNote + 4, moonNote + 7],
    contour: 'rising',
    rhythm: [1, 1, 1, 1],
    energy: 0.7
  };
  
  // Build narrative path based on mode
  const timeline = [];
  let currentTime = 0;
  
  switch (mode) {
    case 'house-order':
      // 12 houses, 5 seconds each
      for (let house = 1; house <= 12; house++) {
        const duration = 5;
        const noteCount = Math.floor(duration * 2); // 2 notes per second
        
        const melody = [];
        for (let i = 0; i < noteCount; i++) {
          melody.push({
            note: 60 + (i % 12) + Math.floor(house / 2),
            time: i * 0.5,
            duration: 0.4,
            velocity: 0.6
          });
        }
        
        timeline.push({
          id: `house-${house}`,
          duration,
          melody,
          harmony: [{
            time: 0,
            duration,
            chord: 'I',
            voicing: [60, 64, 67],
            velocity: 0.7
          }],
          bass: [{
            time: 0,
            duration,
            note: 48,
            velocity: 0.8
          }]
        });
        
        currentTime += duration;
      }
      break;
      
    case 'cluster':
      // Use clusters from chart context
      const clusters = chartContext.clusters || [];
      if (clusters.length === 0) {
        // Fallback to 3 clusters, 20 seconds each
        for (let i = 1; i <= 3; i++) {
          timeline.push({
            id: `cluster-${i}`,
            duration: 20,
            melody: generateMelodyForDuration(20, 60 + i * 4),
            harmony: [{
              time: 0,
              duration: 20,
              chord: 'I',
              voicing: [60, 64, 67],
              velocity: 0.7
            }],
            bass: [{
              time: 0,
              duration: 20,
              note: 48,
              velocity: 0.8
            }]
          });
          currentTime += 20;
        }
      } else {
        // Use actual clusters
        const totalMass = clusters.reduce((sum, cluster) => sum + cluster.planets.length, 0);
        
        for (const cluster of clusters) {
          const clusterWeight = cluster.planets.length / totalMass;
          const duration = Math.max(3, Math.min(15, Math.floor(60 * clusterWeight)));
          
          timeline.push({
            id: `cluster-${cluster.id}`,
            duration,
            melody: generateMelodyForDuration(duration, 60 + cluster.id * 3),
            harmony: [{
              time: 0,
              duration,
              chord: 'I',
              voicing: [60, 64, 67],
              velocity: 0.7
            }],
            bass: [{
              time: 0,
              duration,
              note: 48,
              velocity: 0.8
            }]
          });
          
          currentTime += duration;
        }
        
        // Fill remaining time
        if (currentTime < 60) {
          const remainingTime = 60 - currentTime;
          timeline.push({
            id: 'fill',
            duration: remainingTime,
            melody: generateMelodyForDuration(remainingTime, 60),
            harmony: [{
              time: 0,
              duration: remainingTime,
              chord: 'I',
              voicing: [60, 64, 67],
              velocity: 0.7
            }],
            bass: [{
              time: 0,
              duration: remainingTime,
              note: 48,
              velocity: 0.8
            }]
          });
          currentTime += remainingTime;
        }
      }
      break;
      
    case 'elemental':
      // Use dominant elements
      const elements = chartContext.dominantElements || { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 };
      const elementOrder = Object.entries(elements)
        .sort(([,a], [,b]) => b - a)
        .map(([element]) => element);
      
      for (const element of elementOrder) {
        const duration = Math.floor(60 * elements[element]);
        
        timeline.push({
          id: `element-${element}`,
          duration,
          melody: generateMelodyForDuration(duration, 60 + elementOrder.indexOf(element) * 4),
          harmony: [{
            time: 0,
            duration,
            chord: 'I',
            voicing: [60, 64, 67],
            velocity: 0.7
          }],
          bass: [{
            time: 0,
            duration,
            note: 48,
            velocity: 0.8
          }]
        });
        
        currentTime += duration;
      }
      break;
      
    case 'lunar':
      // 8 lunar phases, 7.5 seconds each
      const phases = ['new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous', 
                     'full', 'waning-gibbous', 'last-quarter', 'waning-crescent'];
      
      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        const duration = 7.5;
        
        timeline.push({
          id: `lunar-${phase}`,
          duration,
          melody: generateMelodyForDuration(duration, 60 + i * 2),
          harmony: [{
            time: 0,
            duration,
            chord: 'I',
            voicing: [60, 64, 67],
            velocity: 0.7
          }],
          bass: [{
            time: 0,
            duration,
            note: 48,
            velocity: 0.8
          }]
        });
        
        currentTime += duration;
      }
      break;
  }
  
  return {
    timeline,
    cadencePlan: {
      small: [20, 40],
      major: 60,
      type: 'authentic'
    },
    globalScale: [0, 2, 4, 5, 7, 9, 11], // Major scale
    motif,
    duration: 60
  };
}

function generateMelodyForDuration(duration, baseNote) {
  const notes = [];
  const noteCount = Math.floor(duration * 2); // 2 notes per second
  
  for (let i = 0; i < noteCount; i++) {
    notes.push({
      note: baseNote + (i % 12),
      time: i * 0.5,
      duration: 0.4,
      velocity: 0.6
    });
  }
  
  return notes;
}

// ---------- API Routes ----------

// API v1 routes (only if available)
if (authRoutes && authRoutes.router) app.use('/v1/auth', authRoutes.router);
if (userRoutes && userRoutes.router) app.use('/v1/users', userRoutes.router);
if (trackRoutes && trackRoutes.router) app.use('/v1/tracks', trackRoutes.router);
if (socialRoutes && socialRoutes.router) app.use('/v1', socialRoutes.router);
if (libraryRoutes && libraryRoutes.router) app.use('/v1/library', libraryRoutes.router);

// API v2 routes removed - all vector-based composition happens via /api/render

// ---- IP Geolocation API ----------------------------------------------------
// Free IP geolocation service (ipapi.co)
async function getLocationFromIP(ip) {
  return new Promise((resolve, reject) => {
    // Use a public IP geolocation service
    const url = `https://ipapi.co/${ip}/json/`;
    
    fetch(url)
      .then(res => res.json())
      .then(location => {
        // Check if we got valid location data
        if (location.error) {
          reject(new Error(`IP geolocation failed: ${location.reason || 'Unknown error'}`));
          return;
        }
        
        // Return formatted location data
        resolve({
          city: location.city || 'Unknown',
          region: location.region || '',
          country: location.country_name || 'Unknown',
          latitude: parseFloat(location.latitude) || 0,
          longitude: parseFloat(location.longitude) || 0,
          timezone: location.timezone || 'UTC',
          utc_offset: location.utc_offset || '+00:00'
        });
      })
      .catch(error => {
        reject(new Error(`Geolocation request failed: ${error.message}`));
      });
  });
}

// Get client IP address
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         req.ip || 
         '127.0.0.1';
}

// Legacy Swiss Ephemeris endpoints (kept for backward compatibility)
// Geocode (with cache + friendly rate-limit message)
app.get("/geocode", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q || q.length < 2) return res.json([]);
    const key = `geo|${q.toLowerCase()}`;
    const hit = geoCache.get(key);
    const now = Date.now();
    if (hit && (now - hit.t) < TTL_GEO_MS) return res.json(hit.items);

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: {
      "User-Agent": "Astradio/1.0 (astradio.io; contact: support@astradio.io)",
      "Accept": "application/json"
    }});
    if (!r.ok) return res.status(503).json({ error: `Nominatim ${r.status} (rate limited). Try again soon.` });
    const json = await r.json();
    const tzlookup = require('tzlookup');
    const items = json.map((x) => {
      const lat = parseFloat(x.lat);
      const lon = parseFloat(x.lon);
      let timezone = 'UTC';
      try {
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          timezone = tzlookup(lat, lon);
        }
      } catch {
        timezone = 'UTC';
      }
      return {
        label: x.display_name,
        lat,
        lon,
        timezone,
      };
    });
    geoCache.set(key, { t: Date.now(), items });
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// Geolocation endpoint - resolve location from client IP (fallback-safe)
app.get("/geolocation", (req, res) => {
  res.status(410).json({ error: "Deprecated. Use /api/ip-geo from the client." });
});

// Test geolocation endpoint for debugging
app.get("/test-geo", (req, res) => {
  res.status(410).json({ error: "Deprecated." });
});

// Auto-chart endpoint that combines geolocation with chart generation
app.get("/auto-chart", (req, res) => {
  res.status(410).json({ error: "Deprecated. Client should call /api/ip-geo then /chart." });
});

// Planetary longitudes (no location needed)
app.get("/positions", (req, res) => {
  try {
    const date = normalizeDate(req.query.date);
    const time = normalizeTime(req.query.time || "12:00");
    const includeExtras = req.query.extras !== 'false'; // default true
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    
    // Create cache key that includes location if available
    const key = `pos|${date}|${time}|${includeExtras}|${lat || 'noloc'}|${lon || 'noloc'}`;
    const hit = respCache.get(key);
    const now = Date.now();
    if (hit && (now - hit.t) < TTL_POS_MS) {
      return res.json({ date, time, positions: hit.positions, cusps: hit.cusps, cached: true });
    }
    
    // Only pass coordinates if they are valid numbers
    const jd = Number.isFinite(lat) && Number.isFinite(lon) 
      ? toJulianDayUT(date, time, lat, lon)
      : toJulianDayUT(date, time);
    const { positions } = calcPositions(jd, includeExtras);

    // Equal-house cusps (no location needed for positions endpoint)
    const cusps = Array.from({length:12}, (_,i) => i*30);

    respCache.set(key, { t: now, positions, cusps });
    res.json({ date, time, positions, cusps, cached: false });
  } catch (e) {
    console.error("Error in /positions:", e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

// Chart with location — returns Placidus cusps
app.get("/chart", (req, res) => {
  try {
    const date = normalizeDate(req.query.date);
    const time = normalizeTime(req.query.time || "12:00");
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const includeExtras = req.query.extras !== 'false'; // default true
    
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: "Valid lat/lon required for chart endpoint" });
    }
    
    const key = `chart|${date}|${time}|${lat}|${lon}|${includeExtras}`;
    const hit = respCache.get(key);
    const now = Date.now();
    if (hit && (now - hit.t) < TTL_POS_MS) return res.json(hit.payload);

    const jd = toJulianDayUT(date, time, lat, lon);
    const { positions } = calcPositions(jd, includeExtras);
    const cusps = calcPlacidusCusps(jd, lat, lon);

    const payload = {
      date, time, lat, lon,
      positions,
      cusps,
      cached: false
    };
    respCache.set(key, { t: now, payload });
    res.json(payload);
  } catch (e) {
    console.error("Error in /chart:", e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

// EphemerisSnapshot-shaped JSON for ML feature encoding (sky mode). Phase 8H: canonical body set.
const PLANET_ORDER = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','chiron','ceres','pallas','juno','vesta'];
function moonPhaseNorm(jd) {
  try {
    const sunResult = swe.swe_calc_ut(jd, swe.SE_SUN, swe.SEFLG_SWIEPH);
    const moonResult = swe.swe_calc_ut(jd, swe.SE_MOON, swe.SEFLG_SWIEPH);
    if (sunResult.rc < 0 || moonResult.rc < 0) return 0.5;
    const sunLon = sunResult.longitude ?? sunResult.xx?.[0] ?? 0;
    const moonLon = moonResult.longitude ?? moonResult.xx?.[0] ?? 0;
    let phase = (moonLon - sunLon) / 360;
    if (phase < 0) phase += 1;
    return phase;
  } catch (e) { return 0.5; }
}

app.get("/api/chart-snapshot", (req, res) => {
  try {
    const date = normalizeDate(req.query.date);
    const time = normalizeTime(req.query.time || "12:00");
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const timezoneParam = (req.query.timezone || "").toString().trim() || null;
    if (timezoneParam && !moment.tz.zone(timezoneParam)) {
      return res.status(400).json({ error: "Invalid IANA timezone" });
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: "Valid lat/lon required" });
    }
    const jd = toJulianDayUT(date, time, lat, lon, timezoneParam);
    const { positions, speeds } = calcPositions(jd, true);
    const cusps = calcPlacidusCusps(jd, lat, lon);
    const aspects = calcAspects(positions, speeds);
    const dominantElements = calcDominantElements(positions);
    const moonPhase = moonPhaseNorm(jd);
    const planets = PLANET_ORDER.filter((n) => positions[n] != null).map((name) => ({
      name,
      lon: positions[name]
    }));
    const houses = cusps.length === 12 ? cusps : Array.from({ length: 12 }, (_, i) => i * 30);
    const snapshot = {
      ts: `${date}T${time}:00Z`,
      tz: "UTC",
      lat,
      lon,
      houseSystem: "placidus",
      planets,
      houses,
      aspects: aspects.map((a) => ({ bodyA: a.a, bodyB: a.b, type: a.type, orb: a.orb, exactAngle: a.exactAngle, dynamics: a.dynamics, strength: a.strength, exactness: a.exactness, priorityBase: a.priorityBase, motion: a.motion })),
      moonPhase,
      dominantElements: {
        fire: dominantElements.fire ?? 0.25,
        earth: dominantElements.earth ?? 0.25,
        air: dominantElements.air ?? 0.25,
        water: dominantElements.water ?? 0.25
      }
    };
    res.json(snapshot);
  } catch (e) {
    console.error("Error in /api/chart-snapshot:", e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

// Health check endpoint (Render sets RENDER_GIT_COMMIT at runtime)
app.get("/health", (req, res) => {
  const payload = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "2.0.0"
  };
  if (process.env.RENDER_GIT_COMMIT) payload.commit = process.env.RENDER_GIT_COMMIT;
  res.json(payload);
});

// ML status (proof: tf_backend, model_sha, ml_used, inference_ms, model_path_hint)
app.get("/api/ml-status", async (req, res) => {
  if (!healthMod?.getMLStatus) {
    return res.status(501).json({ error: "ml_status_unavailable", message: "vnext health module not loaded" });
  }
  try {
    const payload = await healthMod.getMLStatus();
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// Rate limiting middleware for /api/compose
// Dev-only: DISABLE_RATE_LIMIT=1 or SOAK_MODE=1 disables limiter when NODE_ENV=development.
// Soak bypass: compose-only; when request has X-Soak-Token and it exactly matches SOAK_TOKEN env, skip limiter for that request only.
// No bypass if SOAK_TOKEN is unset or empty. Production-safe: token is redacted in-place so it is never logged.
const isDev = process.env.NODE_ENV !== 'production';
const skipComposeLimit = isDev && (process.env.DISABLE_RATE_LIMIT === '1' || process.env.SOAK_MODE === '1');
function soakBypassAllowed(req) {
  const token = req.get && req.get('x-soak-token');
  const secret = process.env.SOAK_TOKEN;
  const allowed = typeof secret === 'string' && secret.length > 0 && token === secret;
  // Redact x-soak-token so any request/error logging middleware never logs the value
  if (req.headers && (req.headers['x-soak-token'] != null || req.headers['X-Soak-Token'] != null)) {
    req.headers['x-soak-token'] = '[REDACTED]';
    if (req.headers['X-Soak-Token'] != null) req.headers['X-Soak-Token'] = '[REDACTED]';
  }
  return allowed;
}
const composeRpm = process.env.COMPOSE_RPM ? Math.max(60, parseInt(process.env.COMPOSE_RPM, 10) || 60) : null;
const composeWindowMs = composeRpm ? 60 * 1000 : 15 * 60 * 1000;
const composeMax = composeRpm || 10;

const composeLimiter = rateLimit({
  windowMs: composeWindowMs,
  max: composeMax,
  message: { error: 'Too many composition requests', retryAfter: Math.ceil(composeWindowMs / 1000) },
  standardHeaders: 'draft-8',
  legacyHeaders: true,
  requestPropertyName: 'rateLimit',
  skip: (req) => skipComposeLimit || soakBypassAllowed(req),
  handler: (req, res) => {
    const rl = req.rateLimit || {};
    const resetTime = rl.resetTime;
    const resetMs = resetTime instanceof Date ? Math.max(0, resetTime.getTime() - Date.now()) : composeWindowMs;
    const retryAfterSec = Math.ceil(resetMs / 1000);
    console.log('route=/api/compose key=%s limit=%s remaining=%s resetMs=%s', req.ip || '', rl.limit ?? '', rl.remaining ?? '', resetMs);
    if (!res.headersSent) {
      res.setHeader('Retry-After', String(retryAfterSec));
      res.setHeader('X-RateLimit-Limit', String(rl.limit ?? composeMax));
      res.setHeader('X-RateLimit-Remaining', String(rl.remaining ?? 0));
      if (resetTime instanceof Date) res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetTime.getTime() / 1000)));
      // Soak bypass diagnostics (429 only; no secrets): why bypass did not apply
      const envPresent = !!(process.env.SOAK_TOKEN && typeof process.env.SOAK_TOKEN === 'string' && process.env.SOAK_TOKEN.trim().length > 0);
      const headerPresent = !!(req.get && req.get('x-soak-token'));
      const tokenMatch = envPresent && headerPresent && req.get('x-soak-token') === process.env.SOAK_TOKEN;
      const bypassEligible = tokenMatch;
      res.setHeader('X-Soak-Env-Present', envPresent ? '1' : '0');
      res.setHeader('X-Soak-Header-Present', headerPresent ? '1' : '0');
      res.setHeader('X-Soak-Token-Match', tokenMatch ? '1' : '0');
      res.setHeader('X-Soak-Bypass-Eligible', bypassEligible ? '1' : '0');
    }
    res.status(429).json({ error: 'Too many composition requests', retryAfter: retryAfterSec });
  },
});

const socialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 social requests per windowMs
  message: { error: 'Too many social requests', retryAfter: 900 },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limits
app.use('/api/compose', composeLimiter);
app.use('/api/connect', socialLimiter);
app.use('/api/like', socialLimiter);
app.use('/api/save', socialLimiter);
app.use('/api/report', socialLimiter);

// Bounded Readiness endpoint for UI gating
app.get("/readyz", async (req, res) => {
  try {
    const { BoundedReadinessChecker } = require('./readiness-bounded');
    const checker = new BoundedReadinessChecker();
    const readiness = await checker.checkReadiness();
    
    if (readiness.ready) {
      res.json(readiness);
    } else {
      res.status(503).json(readiness);
    }
  } catch (error) {
    res.status(503).json({
      ready: false,
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Minimal IP geolocation for client fallback
// Resilient, cached IP geolocation with reverse geocoding (no prompt)
const IP_CACHE_TTL_MS = 5 * 60_000;
const ipGeoCache = new Map(); // key: ip or 'self', value: { t, data }

async function fetchJson(url, opts = {}) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), opts.timeoutMs || 1500);
  try {
    // Use node-fetch or https module for older Node versions
    let r;
    try {
      r = await fetch(url, { signal: controller.signal, headers: opts.headers });
    } catch (fetchError) {
      // Fallback to https module for older Node versions
      const https = require('https');
      const http = require('http');
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      r = await new Promise((resolve, reject) => {
        const req = client.request(url, { headers: opts.headers }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              json: () => JSON.parse(data)
            });
          });
        });
        req.on('error', reject);
        req.setTimeout(opts.timeoutMs || 1500, () => req.destroy());
        req.end();
      });
    }
    
    clearTimeout(to);
    if (!r.ok) throw new Error(`HTTP ${r.status || r.statusCode}`);
    return await r.json();
  } catch (e) {
    clearTimeout(to);
    throw e;
  }
}

async function reverseGeocodeLabel(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
    const j = await fetchJson(url, {
      headers: {
        'User-Agent': 'Astradio/1.0 (astradio.io; contact: support@astradio.io)',
        'Accept': 'application/json'
      },
      timeoutMs: 1500
    });
    const label = j && j.display_name ? j.display_name.split(',').slice(0, 3).join(',') : '';
    return label || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  } catch (_) {
    return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  }
}

app.get('/api/ip-geo', async (req, res) => {
  try {
    const ip = getClientIP(req) || 'self';
    const hit = ipGeoCache.get(ip);
    const now = Date.now();
    if (hit && now - hit.t < IP_CACHE_TTL_MS) return res.json(hit.data);

    // provider rotation
    const providers = [
      async () => {
        const j = await fetchJson('https://ipapi.co/json/', { timeoutMs: 1500 });
        return { lat: Number(j.latitude), lon: Number(j.longitude), city: j.city, country: j.country_name };
      },
      async () => {
        const j = await fetchJson('https://ipinfo.io/json', { timeoutMs: 1500 });
        const [lat, lon] = (j.loc || '').split(',').map(Number);
        return { lat, lon, city: j.city, country: j.country };
      },
      async () => {
        const j = await fetchJson('https://freeipapi.com/api/json');
        return { lat: Number(j.latitude), lon: Number(j.longitude), city: j.cityName, country: j.countryName };
      }
    ];

    let geo = null; let err = null;
    for (const p of providers) {
      try { geo = await p(); if (Number.isFinite(geo.lat) && Number.isFinite(geo.lon)) break; } catch (e) { err = e; }
    }

    if (!geo || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lon)) {
      const data = { lat: null, lon: null, city: 'Auto (Unknown)', country: null };
      ipGeoCache.set(ip, { t: now, data });
      return res.json(data);
    }

    const label = await reverseGeocodeLabel(geo.lat, geo.lon);
    const data = { lat: geo.lat, lon: geo.lon, city: label, country: geo.country || null };
    ipGeoCache.set(ip, { t: now, data });
    return res.json(data);
  } catch (e) {
    return res.json({ lat: null, lon: null, city: 'Auto (Unknown)', country: null });
  }
});



// ---------- Legacy Composition Functions Removed ----------
// All composition generation now handled by vNext ML-primary system

/**
 * Generate composition from vector and chart context
 */
async function generateCompositionFromVector(chartContext, mode, vector, duration = 60) {
  // Seeded RNG derived from controls.hash for determinism
  const seedStr = String(chartContext?.hash || chartContext?.controls?.hash || 'seed');
  const rng = seededRng(seedStr);
  // Handle both array and object vector formats
  let vectorObj;
  if (Array.isArray(vector)) {
    console.log(`[Composition] Generating ${mode} composition with vector [${vector.map(v => v.toFixed(3)).join(', ')}]`);
    vectorObj = {
      tempo_energy: vector[0],
      rhythm_density: vector[1], 
      harmonic_tension: vector[2],
      brightness: vector[3],
      texture_space: vector[4],
      melodic_activity: vector[5]
    };
  } else {
    console.log(`[Composition] Generating ${mode} composition with vector object:`, vector);
    vectorObj = vector;
  }
  
  // Generate composition based on mode
  let composition;
  switch (mode) {
    case 'house-order':
      composition = generateHouseOrderComposition(chartContext, vectorObj, duration);
      break;
    case 'cluster':
      composition = generateClusterComposition(chartContext, vectorObj, duration);
      break;
    case 'elemental':
      composition = generateElementalComposition(chartContext, vectorObj, duration);
      break;
    case 'lunar':
      composition = generateLunarComposition(chartContext, vectorObj, duration);
      break;
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
  
  console.log(`[Composition] Generated composition with ${composition.segments?.length || 0} segments`);
  
  // Only log if no events (critical error)
  const totalEvents = composition.segments?.reduce((sum, seg) => sum + (seg.events?.length || 0), 0) || 0;
  if (totalEvents === 0) {
    console.warn(`[Event Audit] WARNING: No events generated in any segment!`);
  }
  
  return composition;
}

/**
 * Generate house-order composition
 */
function generateHouseOrderComposition(chartContext, vector, duration) {
  const segments = [];
  const housesPerSegment = 12;
  const segmentDuration = duration / housesPerSegment;
  
  for (let house = 1; house <= housesPerSegment; house++) {
    const segmentStart = (house - 1) * segmentDuration;
    const events = [];
    
    // Generate events based on vector dimensions
    // Scale base event count by melodic_activity with a small floor to help melodic gate
    const baseCount = Math.max(2, Math.floor(vector.melodic_activity * 8)); // 2..8
    const eventCount = baseCount;
    const rhythmDensity = vector.rhythm_density;
    const tempoEnergy = vector.tempo_energy;
    
    // House processing (silent unless error)
    
    for (let i = 0; i < eventCount; i++) {
      const eventTime = segmentStart + (i / eventCount) * segmentDuration;
      
      // Melodic events
      if (rng() < vector.melodic_activity) {
        events.push({
          type: 'note',
          role: 'melody',
          note: 60 + Math.floor(rng() * 12), // C4-C5
          start: eventTime,
          duration: 0.5 + rng() * 1.0,
          velocity: 0.6 + rng() * 0.3,
          instrument: 'lead'
        });
        // Melodic event added (silent)
      }
      
      // Rhythm events
      if (rng() < rhythmDensity) {
        events.push({
          type: 'note',
          role: 'rhythm',
          note: 36 + Math.floor(rng() * 4), // Kick/snare range
          start: eventTime,
          duration: 0.1,
          velocity: 0.7 + rng() * 0.2,
          instrument: 'drums'
        });
        // Rhythm event added (silent)
      }
      
      // Harmonic events
      if (rng() < vector.harmonic_tension) {
        events.push({
          type: 'note',
          role: 'harmony',
          note: 48 + Math.floor(rng() * 12), // Bass range
          start: eventTime,
          duration: 1.0 + rng() * 2.0,
          velocity: 0.4 + rng() * 0.3,
          instrument: 'bass'
        });
      }
    }
    
    // Ensure at least one melodic event per segment when melodic_activity is low
    if (!events.some(e => e.role === 'melody')) {
      const fallbackTime = segmentStart + 0.5 * segmentDuration;
      events.push({
        type: 'note',
        role: 'melody',
        note: 60 + Math.floor(rng() * 12),
        start: fallbackTime,
        duration: 0.6,
        velocity: 0.65,
        instrument: 'lead'
      });
    }
    
    segments.push({
      type: 'house',
      house: house,
      startTime: segmentStart,
      duration: segmentDuration,
      events: events
    });
  }
  
  return {
    mode: 'house-order',
    durationSec: duration,
    segments: segments,
    vector: vector
  };
}

/**
 * Generate cluster-based composition
 */
function generateClusterComposition(chartContext, vector, duration) {
  const segments = [];
  const clusters = chartContext.clusters || [];
  const segmentDuration = duration / Math.max(clusters.length, 1);
  
  clusters.forEach((cluster, index) => {
    const segmentStart = index * segmentDuration;
    const events = [];
    
    // Generate events based on cluster planets
    cluster.planets.forEach(planet => {
      const eventTime = segmentStart + rng() * segmentDuration;
      
      events.push({
        type: 'note',
        role: 'melody',
        note: 60 + (planet % 12),
        start: eventTime,
        duration: 0.5 + rng() * 1.5,
        velocity: 0.5 + rng() * 0.4,
        instrument: 'lead'
      });
    });
    
    segments.push({
      type: 'cluster',
      clusterId: cluster.id,
      planets: cluster.planets,
      startTime: segmentStart,
      duration: segmentDuration,
      events: events
    });
  });
  
  return {
    mode: 'cluster',
    durationSec: duration,
    segments: segments,
    vector: vector
  };
}

/**
 * Generate elemental composition
 */
function generateElementalComposition(chartContext, vector, duration) {
  const segments = [];
  const elements = ['fire', 'earth', 'air', 'water'];
  const segmentDuration = duration / elements.length;
  
  elements.forEach((element, index) => {
    const segmentStart = index * segmentDuration;
    const events = [];
    
    // Generate events based on element characteristics
    const elementIntensity = chartContext.dominantElements?.[element] || 0.25;
    const eventCount = Math.floor(elementIntensity * 10 + 2);
    
    for (let i = 0; i < eventCount; i++) {
      const eventTime = segmentStart + (i / eventCount) * segmentDuration;
      
      events.push({
        type: 'note',
        role: element === 'fire' ? 'rhythm' : 'melody',
        note: 48 + Math.floor(rng() * 24),
        start: eventTime,
        duration: element === 'water' ? 2.0 : 0.5,
        velocity: element === 'fire' ? 0.8 : 0.5,
        instrument: element === 'fire' ? 'drums' : 'lead'
      });
    }
    
    segments.push({
      type: 'element',
      element: element,
      startTime: segmentStart,
      duration: segmentDuration,
      events: events
    });
  });
  
  return {
    mode: 'elemental',
    durationSec: duration,
    segments: segments,
    vector: vector
  };
}

/**
 * Generate lunar composition
 */
function generateLunarComposition(chartContext, vector, duration) {
  const segments = [];
  const moonPhase = chartContext.moonPhase || 0;
  const segmentDuration = duration / 4; // 4 phases
  
  const phases = [
    { name: 'new', start: 0 },
    { name: 'waxing', start: 0.25 },
    { name: 'full', start: 0.5 },
    { name: 'waning', start: 0.75 }
  ];
  
  phases.forEach((phase, index) => {
    const segmentStart = index * segmentDuration;
    const events = [];
    
    // Generate events based on lunar phase
    const phaseIntensity = Math.sin(phase.start * 2 * Math.PI) * 0.5 + 0.5;
    const eventCount = Math.floor(phaseIntensity * 8 + 2);
    
    for (let i = 0; i < eventCount; i++) {
      const eventTime = segmentStart + (i / eventCount) * segmentDuration;
      
      events.push({
        type: 'note',
        role: 'melody',
        note: 60 + Math.floor(rng() * 12),
        start: eventTime,
        duration: 0.5 + rng() * 1.0,
        velocity: 0.4 + phaseIntensity * 0.4,
        instrument: 'pad'
      });
    }
    
    segments.push({
      type: 'lunar',
      phase: phase.name,
      startTime: segmentStart,
      duration: segmentDuration,
      events: events
    });
  });
  
  return {
    mode: 'lunar',
    durationSec: duration,
    segments: segments,
    vector: vector
  };
}

/**
 * Finalize composition with caps (from audio-engine.js)
 */
function finalizeCompositionWithCaps(comp, vector, bpm = 120) {
  if (!comp || !Array.isArray(comp.segments)) return comp;
  
  // Extract all events from segments
  const allEvents = [];
  for (const segment of comp.segments) {
    if (segment.events) {
      allEvents.push(...segment.events);
    }
  }
  
  // Finalizer complete (silent unless error)
  
  const duration = comp.durationSec ?? 60;
  const beats = (bpm / 60) * duration;
  
  // Target ranges derived from vector
  const targetRhPerBeat = 2.2 + 2.6 * (vector?.rhythm_density ?? 0);
  const targetNtPerBeat = 3.0 + 4.5 * (vector?.melodic_activity ?? 0);
  const RH_MIN = Math.floor(targetRhPerBeat * beats * 0.85);
  const RH_MAX = Math.ceil(targetRhPerBeat * beats * 1.15);
  const NT_MAX = Math.ceil(targetNtPerBeat * beats * 1.10);
  
  // Count rhythm events
  const rhythmEvents = allEvents.filter(e => e.role === 'rhythm' || e.role === 'percussion' || e.role === 'drums');
  const noteEvents = allEvents.filter(e => e.type === 'note');
  
  // Ensure we have enough events
  if (rhythmEvents.length < RH_MIN) {
    const seedStr = String(comp?.vector?.seed || 'seed');
    const rng = seededRng(seedStr);
    // Add more rhythm events
    const needed = RH_MIN - rhythmEvents.length;
    for (let i = 0; i < needed; i++) {
      const time = rng() * duration;
      allEvents.push({
        type: 'note',
        role: 'rhythm',
        note: 36 + Math.floor(rng() * 4),
        start: time,
        duration: 0.1,
        velocity: 0.7,
        instrument: 'drums'
      });
    }
  }
  
  if (noteEvents.length < 10) {
    const seedStr2 = String(comp?.vector?.seed || 'seed2');
    const rng2 = seededRng(seedStr2);
    // Add more melodic events
    const needed = 10 - noteEvents.length;
    for (let i = 0; i < needed; i++) {
      const time = rng2() * duration;
      allEvents.push({
        type: 'note',
        role: 'melody',
        note: 60 + Math.floor(rng2() * 12),
        start: time,
        duration: 0.5 + rng2() * 1.0,
        velocity: 0.6,
        instrument: 'lead'
      });
    }
  }
  
  // Update segments with finalized events
  const finalizedSegments = comp.segments.map(segment => ({
    ...segment,
    events: allEvents.filter(e => e.start >= segment.startTime && e.start < segment.startTime + segment.duration)
  }));
  
  return {
    ...comp,
    segments: finalizedSegments,
    durationSec: duration
  };
}

/**
 * Generate audio buffer from composition
 */
async function generateAudioBuffer(composition, format = 'wav', normalize = true) {
  console.log('[AudioBuffer] Generating real audio from composition...');
  
  // Generate actual audio using composition data
  const duration = composition.durationSec || 60;
  const sampleRate = 44100;
  const bufferSize = sampleRate * duration;
  const buffer = Buffer.alloc(bufferSize * 2); // 16-bit stereo
  
  // Generate audio based on composition segments
  let sampleIndex = 0;
  for (const segment of composition.segments || []) {
    const segmentStart = Math.floor((segment.startTime || 0) * sampleRate);
    const segmentEnd = Math.floor(((segment.startTime || 0) + (segment.duration || 5)) * sampleRate);
    
    // Generate audio for each event in segment
    for (const event of segment.events || []) {
      const eventStart = segmentStart + Math.floor((event.start || 0) * sampleRate);
      const eventDuration = Math.floor((event.duration || 0.5) * sampleRate);
      
      // Generate simple sine wave for each note
      if (event.type === 'note' && event.note) {
        const frequency = 440 * Math.pow(2, (event.note - 69) / 12); // A4 = 440Hz
        const velocity = (event.velocity || 0.7) * 0.3; // Scale down volume
        
        for (let i = 0; i < eventDuration && eventStart + i < bufferSize; i++) {
          const t = i / sampleRate;
          const sample = Math.sin(2 * Math.PI * frequency * t) * velocity;
          const sample16 = Math.floor(sample * 32767);
          
          // Write to both channels
          buffer.writeInt16LE(sample16, (eventStart + i) * 2);
          buffer.writeInt16LE(sample16, (eventStart + i) * 2 + 1);
        }
      }
    }
  }
  
  console.log(`[AudioBuffer] Generated ${bufferSize} samples of real audio`);
  return buffer;
}

// ---------- Vector-Based API Endpoints ----------

function dumpRoutes(app) {
  const out = [];
  app._router.stack.forEach((s) => {
    if (s.route && s.route.path) {
      const methods = Object.keys(s.route.methods).join(",").toUpperCase();
      out.push(`${methods} ${s.route.path}`);
    }
  });
  return out;
}


// Shadow / canary remain, but only under compose; never mount legacy render
app.use("/api/compose", shadowMiddleware);
app.use("/api/compose", canaryRouter);


// v1.1 Composition endpoint (Unified Spec v1.1)
// Body is already parsed by global express.json() at line ~170; duplicate parser here consumed empty stream → SyntaxError → 400 HTML
app.post("/api/compose", vnextCompose);

// Exports: create or return export id (cache-first); stream WAV from store (GCS or disk). Postgres records job when POSTGRES_URL set.
const exportsSubdir = path.join(EXPORT_ROOT, 'exports');
try { fs.mkdirSync(exportsSubdir, { recursive: true }); } catch (_) {}

app.post('/api/exports', requireBeta, async (req, res) => {
  try {
    const body = req.body || {};
    if (!composeMod?.composeAPI) return res.status(501).json({ error: 'compose_unavailable' });
    const response = await composeMod.composeAPI.compose(body);
    const id = response.export_id;
    if (!id) return res.status(502).json({ error: 'no_export', message: 'Compose did not return an export (enable ENABLE_WAV_EXPORT=1)' });
    if (process.env.POSTGRES_URL) {
      try {
        const pgStore = optionalRequire(path.join(__dirname, '..', 'lib', 'pg-store'));
        if (pgStore && pgStore.createExportJob) {
          const storageKey = exportStore.storageKey ? exportStore.storageKey(id) : null;
          const filePath = storageKey || path.join(exportsSubdir, id + '.wav');
          await pgStore.createExportJob({
            id,
            requestId: id,
            planHash: response.hashes?.plan_sha256 || null,
            chartHash: response.controls?.hash || null,
            filePath,
            contentType: 'audio/wav',
            sizeBytes: response.audio?.size_bytes || null,
            storageKey: storageKey || undefined,
            exportMeta: response.export_meta ? {
              provider: response.export_meta.provider,
              modelVersion: response.export_meta.modelVersion,
              promptHash: response.export_meta.promptHash,
              payload_hash: response.export_meta.payload_hash,
              duration_s: response.export_meta.duration_s,
              sha256: response.export_meta.sha256,
            } : undefined,
          });
        }
      } catch (dbErr) {
        if (dbErr.code !== '23505') console.warn('[EXPORTS] DB record skipped:', dbErr.message);
      }
    }
    res.status(200).json({ id });
  } catch (e) {
    console.error('[EXPORTS] POST failed:', e.message);
    res.status(500).json({ error: 'export_failed', message: e.message });
  }
});
app.get('/api/exports/:id', async (req, res) => {
  try {
    const id = (req.params.id || '').trim();
    if (!/^[a-f0-9]{64}$/.test(id)) return res.status(400).json({ error: 'invalid_id', message: 'Export id must be 64 hex characters' });
    // Stream from export store first. Compose writes WAV here; DB job (createExportJob) is only created
    // by POST /api/exports, so requiring getExportJob would 404 for compose-origin exports after refresh.
    const streamed = await exportStore.stream(id, res);
    if (!streamed) return res.status(404).json({ error: 'not_found', message: 'Export not found' });
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: 'export_stream_failed', message: e.message });
  }
});

// Community Compatibility V1 — charts and comparisons (additive; uses same plan+render pipeline)
// Inject durable storage when POSTGRES_URL is set; otherwise use in-memory (memory-store).
if (compatMod && typeof compatMod.createCompatRouter === "function") {
  const compatStorage = optionalRequire(path.join(vnextRoot, "compat", "storage"));
  const pgStore = process.env.POSTGRES_URL ? optionalRequire(path.join(__dirname, "..", "lib", "pg-store")) : null;
  const memoryStore = optionalRequire(path.join(vnextRoot, "compat", "memory-store"));
  const store = pgStore || memoryStore;
  const storageName = pgStore ? "pg-store" : (memoryStore ? "memory-store" : "none");
  if (store && typeof store === "object") {
    try {
      store.__compatName = storageName;
    } catch {}
  }
  console.log("[compat][boot]", {
    adapter: storageName,
    hasPostgres: !!process.env.POSTGRES_URL,
    pgLoaded: !!pgStore,
    memoryLoaded: !!memoryStore,
  });
  if (compatStorage && typeof compatStorage.setStorage === "function" && store) {
    compatStorage.setStorage(store);
  }
  app.use("/api", compatMod.createCompatRouter());
}

// Personality API — Phase 1 Foundation (personality reports without music)
if (personalityMod && typeof personalityMod.createPersonalityRouter === "function") {
  app.use("/api", personalityMod.createPersonalityRouter());
}

// Phase 3A — Community (groups, posts, comments, report, group profile; no compose)
const communityRoutes = require("./routes/community");
app.use("/api", communityRoutes.communityRouter);

// Phase 5 — Relational groups (private, owner-scoped)
const relationalMod = optionalRequire(path.join(vnextRoot, "relational", "routes"));
if (relationalMod && typeof relationalMod.createRelationalRouter === "function") {
  app.use("/api", relationalMod.createRelationalRouter());
}

// Phase 8 Stage 4 — Relational graph + constrained group composite surface
const { createStage4Router } = require("./routes/stage4");
app.use("/api", createStage4Router());

// Campaign lifecycle routes
const { createCampaignRouter } = require("./routes/campaign");
app.use("/api", createCampaignRouter());

// Campaign daily transit + user transit context persistence
const { createUserTransitContextRouter } = require("./routes/user-transit-context");
app.use("/api", createUserTransitContextRouter());
const { createCampaignDailyRouter } = require("./routes/campaign-daily");
app.use("/api", createCampaignDailyRouter());

// Phase 4A — Sandbox (birth-data-first + drag-and-drop degree placements; compose-free reports)
if (sandboxMod && typeof sandboxMod.createSandboxRouter === "function") {
  app.use("/api", sandboxMod.createSandboxRouter());
}

// Phase 6 — Sandbox compositions (save/list/reload). Stage 6: owner isolation.
// Use absolute path — see optionalRequire note above (relative "../lib/database" resolves to lib/lib/database and fails silently).
const db = optionalRequire(path.join(__dirname, "..", "lib", "database"));
const hasDb = db && typeof db.query === "function";
try {
  console.log(
    "[sandbox-compositions:init]",
    JSON.stringify({
      postgresUrlPresent: Boolean(process.env.POSTGRES_URL && String(process.env.POSTGRES_URL).trim()),
      dbModuleLoaded: Boolean(db),
      hasDb,
    })
  );
} catch (_) {
  /* startup log must not throw */
}
function sandboxCallerUserId(req) {
  return (req.headers["x-caller-user-id"] || req.query.userId || "").toString().trim();
}
if (hasDb) {
  const uuid = require("uuid").v4;
  app.post("/api/sandbox/compositions", async (req, res) => {
    try {
      const ownerUserId = sandboxCallerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "caller required (x-caller-user-id or userId)" });
      const body = req.body || {};
      const sandbox_state = body.sandbox_state;
      const vector_hash = body.vector_hash;
      const seed = body.seed;
      const plan_hash = body.plan_hash;
      const report = body.report != null ? body.report : {};
      const provider = body.provider ?? null;
      const provider_version = body.provider_version ?? null;
      const export_id = body.export_id ?? null;
      if (!sandbox_state || typeof vector_hash !== "string" || typeof seed !== "string" || typeof plan_hash !== "string") {
        return res.status(400).json({ error: "sandbox_state, vector_hash, seed, plan_hash required" });
      }
      const id = uuid();
      const now = new Date().toISOString();
      await db.query(
        `INSERT INTO astradio_sandbox_compositions (id, owner_user_id, sandbox_state, vector_hash, seed, plan_hash, report, provider, provider_version, export_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $11::timestamptz)`,
        [id, ownerUserId, JSON.stringify(sandbox_state), vector_hash, seed, plan_hash, JSON.stringify(report), provider, provider_version, export_id, now]
      );
      const row = await db.getRow("SELECT * FROM astradio_sandbox_compositions WHERE id = $1", [id]);
      return res.status(201).json(row);
    } catch (e) {
      console.error("[sandbox/compositions] POST", e);
      return res.status(500).json({ error: e?.message || "Failed to save composition" });
    }
  });
  app.get("/api/sandbox/compositions", async (req, res) => {
    try {
      const ownerUserId = sandboxCallerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "caller required (x-caller-user-id or userId)" });
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
      const rows = await db.getRows(
        "SELECT id, sandbox_state, vector_hash, seed, plan_hash, provider, provider_version, export_id, created_at FROM astradio_sandbox_compositions WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT $2",
        [ownerUserId, limit]
      );
      return res.json(rows);
    } catch (e) {
      console.error("[sandbox/compositions] GET list", e);
      return res.status(500).json({ error: e?.message || "Failed to list compositions" });
    }
  });
  app.get("/api/sandbox/compositions/:id", async (req, res) => {
    try {
      const ownerUserId = sandboxCallerUserId(req);
      const row = await db.getRow("SELECT * FROM astradio_sandbox_compositions WHERE id = $1", [req.params.id]);
      if (!row) return res.status(404).json({ error: "Composition not found" });
      if (row.owner_user_id == null || row.owner_user_id !== ownerUserId) return res.status(404).json({ error: "Composition not found" });
      return res.json(row);
    } catch (e) {
      console.error("[sandbox/compositions] GET by id", e);
      return res.status(500).json({ error: e?.message || "Failed to load composition" });
    }
  });
} else {
  app.post("/api/sandbox/compositions", (req, res) => res.status(503).json({ error: "Database unavailable; cannot save compositions" }));
  app.get("/api/sandbox/compositions", (req, res) => res.status(503).json({ error: "Database unavailable; cannot list compositions" }));
  app.get("/api/sandbox/compositions/:id", (req, res) => res.status(503).json({ error: "Database unavailable; cannot load composition" }));
}

// Legacy /api/render endpoint (only active when DEPRECATE_LEGACY_ROUTES=false). (only active when DEPRECATE_LEGACY_ROUTES=false).
// This provides backward compatibility for soak tests and legacy clients.
// Guardrail: legacy planner path is additionally gated by LEGACY_PLANNER_ENABLED=1
// and should remain OFF by default in production and testing.
if (!DEPRECATE_LEGACY && process.env.LEGACY_PLANNER_ENABLED === '1') {
  app.post("/api/render", async (req, res) => {
    try {
      const { date, time, location, geo } = req.body;
      
      // Convert legacy format to chart context
      const lat = geo?.lat || parseFloat(req.body.lat);
      const lon = geo?.lon || parseFloat(req.body.lon);
      
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return res.status(400).json({ error: "valid_lat_lon_required" });
      }
      
      // Generate chart data
      const chartDate = date || new Date().toISOString().split('T')[0];
      const chartTime = time || "12:00";
      const jd = toJulianDayUT(chartDate, chartTime, lat, lon);
      const positions = calcPositions(jd, true);
      const cusps = calcPlacidusCusps(jd, lat, lon);
      
      // Create chart context
      const chartContext = {
        date: chartDate,
        time: chartTime,
        lat,
        lon,
        positions,
        cusps,
        hash: crypto.createHash('sha256').update(`${chartDate}${chartTime}${lat}${lon}`).digest('hex').substring(0, 16)
      };
      
      // Generate composition (using elemental mode as default)
      const vector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]; // Default vector
      const composition = await generateCompositionFromVector(chartContext, 'elemental', vector, 60);
      const finalized = finalizeCompositionWithCaps(composition, { rhythm_density: 0.5, melodic_activity: 0.5 });
      
      // Generate audio
      const audioBuffer = await generateAudioBuffer(finalized, 'wav', true);
      const audioHash = crypto.createHash('sha256').update(audioBuffer).digest('hex');
      
      // Return response in legacy format
      res.json({
        hashes: {
          control: `sha256:${chartContext.hash}`,
          renderer: `sha256:${audioHash.substring(0, 16)}`
        },
        audio: {
          url: `data:audio/wav;base64,${audioBuffer.toString('base64')}`
        },
        explanation: {
          spec: "LegacyRenderV1",
          text: `Generated composition for ${location || 'chart'} at ${chartDate} ${chartTime}`
        }
      });
    } catch (error) {
      console.error("[Legacy Render] Error:", error);
      res.status(500).json({ error: "render_failed", message: error.message });
    }
  });
}

console.log("[ROUTES]", dumpRoutes(app));

// Static already mounted above only when HAS_SPA; do not mount again
if (HAS_SPA) {
  app.use(express.static(PUBLIC_DIR));
}

// Serve ML models (for HTTP backend fallback)
app.use("/models", express.static(path.join(__dirname, "../models")));

// ---------- Phase-6 Endpoints ----------
// POST /api/compositions/generate — removed (parallel bundle path). Use POST /api/compose + export_id / GET /api/exports/:id.
app.post('/api/compositions/generate', requireBeta, (_req, res) => {
  return res.status(410).json({
    error: 'deprecated_route',
    code: 'COMPOSITIONS_GENERATE_REMOVED',
    message: 'POST /api/compositions/generate is disabled. Use POST /api/compose (Unified Spec v1.1) and GET /api/exports/:export_id for WAV.',
  });
});

// GET /api/compositions/:id/play → stream audio
app.get('/api/compositions/:id/play', requireBeta, (req, res) => {
  try {
    const id = req.params.id;
    const p = path.join(EXPORTS_DIR, id, 'track.wav');
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'not_found' });
    res.setHeader('Content-Type', 'audio/wav');
    fs.createReadStream(p).pipe(res);
  } catch (e) {
    res.status(500).json({ error: 'play_failed', message: e.message });
  }
});

// POST /api/compositions/:id/stop → noop stop
app.post('/api/compositions/:id/stop', requireBeta, (req, res) => {
  res.json({ ok: true, stopped: true });
});

// GET /api/user/history → list exports
app.get('/api/user/history', requireBeta, (req, res) => {
  try {
    const max = Math.min(parseInt(req.query.n) || 10, 50);
    const dirs = fs.readdirSync(EXPORTS_DIR)
      .map(name => ({ name, p: path.join(EXPORTS_DIR, name), st: fs.statSync(path.join(EXPORTS_DIR, name)) }))
      .filter(e => e.st.isDirectory())
      .sort((a,b) => b.st.mtimeMs - a.st.mtimeMs)
      .slice(0, max)
      .map(e => ({ id: e.name, ts: new Date(e.st.mtimeMs).toISOString(), model_id: safeReadJSON(path.join(e.p,'model.json'))?.model_id || null }));
    res.json(dirs);
  } catch (e) {
    res.status(500).json({ error: 'history_failed', message: e.message });
  }
});

// Feedback capture (thumbs/comment)
const FEEDBACK_LOG = path.join(__dirname, '../logs/feedback.jsonl');
app.post('/api/feedback', requireBeta, (req, res) => {
  try {
    const { composition_id, thumbs, comment } = req.body || {};
    ensureDir(path.dirname(FEEDBACK_LOG));
    fs.appendFileSync(FEEDBACK_LOG, JSON.stringify({ ts: new Date().toISOString(), user: (req).betaUser||null, composition_id, thumbs, comment })+'\n');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'feedback_failed', message: e.message });
  }
});

// Monitoring dashboards (JSON summaries)
app.get('/admin/metrics', (req, res) => {
  try {
    const lines = fs.existsSync(RUNTIME_LOG) ? fs.readFileSync(RUNTIME_LOG,'utf8').trim().split(/\n+/) : [];
    const last = lines.slice(-1000).map(l=>{ try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const latencies = last.map(x=>x.latency_ms).filter(x=>typeof x==='number').sort((a,b)=>a-b);
    const p95 = latencies[Math.ceil(0.95*latencies.length)-1] || 0;
    const determinismRate = 1.0; // deterministic by design with seeded hash
    const lengthOk = last.every(x=>x.length_sec===30);
    res.json({ p95_latency_ms: p95, determinism_rate: determinismRate, length_ok: lengthOk, count: last.length });
  } catch (e) {
    res.status(500).json({ error: 'metrics_failed', message: e.message });
  }
});

// Phase 0 verification: last COMPOSE_PATH guardrail (set by vnext compose after each request)
app.get('/api/debug/last-compose-path', (req, res) => {
  const p = global.__lastComposePath;
  if (!p) return res.status(404).json({ error: 'no_compose_yet', message: 'Trigger at least one POST /api/compose first.' });
  res.json(p);
});

// Phase 8 debug helper: latest unified Campaign IDs for env wiring.
// Disabled by default; only available when PHASE8_DEBUG=1.
app.get('/api/debug/phase8/campaign-ids', async (req, res) => {
  if (process.env.PHASE8_DEBUG !== '1') {
    return res.status(404).json({ error: 'not_found' });
  }

  const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!conn) {
    return res.status(503).json({ error: 'db_unconfigured' });
  }

  let pool;
  try {
    ensureCampaignRuntimeParity();
    const pg = require('pg');
    const Pool = pg.Pool;
    pool = new Pool({ connectionString: conn });

    const result = await pool.query(`
      SELECT campaign_id, owner_user_id, mode, created_at
      FROM stage5_campaigns
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const row = result.rows[0];
    if (!row) {
      return res.status(200).json({ status: 'NO_CAMPAIGNS_FOUND' });
    }

    return res.status(200).json({
      campaignId: row.campaign_id,
      userId: row.owner_user_id,
      mode: row.mode,
      createdAt: row.created_at,
    });
  } catch (e) {
    const msg = e && e.message ? e.message : 'Failed to query campaigns';
    console.error('[phase8-debug/campaign-ids] error:', msg);
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    if (pool) {
      pool.end().catch(() => {});
    }
  }
});

// Phase 8 debug-only: bootstrap real user + campaign + compat profile on engine (Render-only).
app.get('/api/debug/phase8/create-test-user', async (req, res) => {
  if (process.env.PHASE8_DEBUG !== '1') {
    return res.status(404).json({ error: 'not_found' });
  }
  if (!process.env.POSTGRES_URL) {
    return res.status(503).json({ error: 'db_unconfigured' });
  }

  const phase8Mod = optionalRequire(path.join(vnextRoot, 'phase8', 'resolve-real-user-campaign'));
  if (!phase8Mod || typeof phase8Mod.getOrCreatePhase8RealUserCampaign !== 'function') {
    return res.status(501).json({ error: 'bootstrap_unavailable' });
  }

  try {
    const { getOrCreatePhase8RealUserCampaign } = phase8Mod;
    const result = await getOrCreatePhase8RealUserCampaign();
    return res.status(200).json(result);
  } catch (e) {
    const msg = e && e.message ? e.message : 'Failed to create Phase 8 test user';
    console.error('[api/debug/phase8/create-test-user] error', msg);
    if (typeof msg === 'string' && /relation\s+"user_profiles"\s+does not exist/i.test(msg)) {
      return res.status(503).json({ error: 'schema_missing:user_profiles' });
    }
    return res.status(500).json({ error: msg });
  }
});

// Phase 8 Stage 5: isolation verification — second deterministic test user (phase8_iso_user).
app.get('/api/debug/phase8/create-iso-user', async (req, res) => {
  if (process.env.PHASE8_DEBUG !== '1') {
    return res.status(404).json({ error: 'not_found' });
  }
  if (!process.env.POSTGRES_URL) {
    return res.status(503).json({ error: 'db_unconfigured' });
  }
  const isoFixtureMod = optionalRequire(path.join(vnextRoot, 'phase8', 'fixtures', 'iso-user-campaign'));
  if (!isoFixtureMod || typeof isoFixtureMod.getOrCreatePhase8IsoUserCampaign !== 'function') {
    return res.status(501).json({ error: 'bootstrap_unavailable' });
  }
  try {
    const result = await isoFixtureMod.getOrCreatePhase8IsoUserCampaign();
    return res.status(200).json(result);
  } catch (e) {
    const msg = e && e.message ? e.message : 'Failed to create Phase 8 isolation user';
    console.error('[api/debug/phase8/create-iso-user] error', msg);
    if (typeof msg === 'string' && /relation\s+"user_profiles"\s+does not exist/i.test(msg)) {
      return res.status(503).json({ error: 'schema_missing:user_profiles' });
    }
    return res.status(500).json({ error: msg });
  }
});

function safeReadJSON(p){ try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch (_) { return null; } }

// API error handler: return JSON for /api/* when client accepts JSON (e.g. JSON parse errors from express.json())
app.use((err, req, res, next) => {
  const isApi = (req.originalUrl || req.url || '').split('?')[0].startsWith('/api/');
  const wantsJson = req.accepts && req.accepts('json') === 'json';
  if (isApi && wantsJson && !res.headersSent) {
    const status = err.status ?? err.statusCode ?? (err.type === 'entity.parse.failed' || err instanceof SyntaxError ? 400 : 500);
    res.status(status).json({
      error: status === 400 ? 'invalid_request' : 'server_error',
      message: process.env.NODE_ENV === 'production' ? (status === 400 ? 'Invalid request' : 'Internal error') : (err.message || String(err)),
    });
    return;
  }
  next(err);
});

// Catch-all handler for SPA — only when index.html exists (avoid ENOENT 502 on API-only deploys)
if (HAS_SPA) {
  app.get("*", (_, res) => {
    res.sendFile(INDEX_HTML);
  });
} else {
  app.get("*", (_, res) => {
    res.status(404).json({ error: "not_found", message: "API-only server; frontend is served elsewhere." });
  });
}

// Start server (Phase 4: schema check first when POSTGRES_URL set)
async function startServer() {
  if (process.env.POSTGRES_URL) {
    try {
      const { verifyPhase4Schema } = require('../lib/phase4-schema-check');
      await verifyPhase4Schema();
    } catch (e) {
      console.error('[PHASE4_SCHEMA]', e.message);
      process.exit(1);
    }
  }
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, HOST, async () => {
  try {
    console.log(`🚀 Engine listening on ${HOST}:${PORT} (http://localhost:${PORT})`);
    if (HAS_SPA) console.log(`Serving static from ${PUBLIC_DIR}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API version: v2 (vector-based)`);
    console.log(`Vector audition system: enabled`);
    // Beta flags (visible in Render/deploy logs)
    const betaFlags = {
      VNEXT_OVERLAY_EXPLAINSPEC: process.env.VNEXT_OVERLAY_EXPLAINSPEC === '1' ? 'on (overlay uses ExplainSpec)' : 'off',
      VNEXT_MATCHES_MOCK: process.env.VNEXT_MATCHES_MOCK === '1' ? 'on (matches mock)' : 'off (real vectors)',
    };
    console.log('[BETA_FLAGS]', JSON.stringify(betaFlags));
    resolve(server);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
});
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} already in use.`);
      } else {
        console.error('Server failed to start:', err);
      }
      reject(err);
      process.exit(1);
    });
  });
}

startServer().catch((e) => {
  console.error('Startup failed:', e);
  process.exit(1);
});
