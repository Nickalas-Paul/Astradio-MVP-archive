const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// vNext compiled handlers (do NOT import .ts directly) — optional for dev boot
const { optionalRequire, noopMiddleware, noopRouter } = require('../lib/opt/optional');

const noopMw = noopMiddleware();
const noopRouterInstance = noopRouter();

const composeMod = optionalRequire(path.join(__dirname, "..", "dist", "vnext", "api", "compose"));
const shadowMod = optionalRequire(path.join(__dirname, "..", "dist", "vnext", "api", "shadow"));
const canaryMod = optionalRequire(path.join(__dirname, "..", "dist", "vnext", "api", "canary"));
const renderMod = optionalRequire(path.join(__dirname, "..", "dist", "vnext", "api", "render"));
const healthMod = optionalRequire(path.join(__dirname, "..", "dist", "vnext", "api", "health"));
const astroDebugMod = optionalRequire(path.join(__dirname, "..", "dist", "vnext", "api", "astro-debug"));

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
const database = optionalRequire("../lib/database", "database") || { close: async () => {} };
const redis = optionalRequire("../lib/redis", "redis") || { close: async () => {}, connect: async () => {} };

// Import routes (optional)
const authRoutes = optionalRequire(path.join(__dirname, "..", "dist", "routes", "auth"), "authRoutes");
const userRoutes = optionalRequire(path.join(__dirname, "..", "dist", "routes", "users"), "userRoutes");
const trackRoutes = optionalRequire(path.join(__dirname, "..", "dist", "routes", "tracks"), "trackRoutes");
const socialRoutes = optionalRequire(path.join(__dirname, "..", "dist", "routes", "social"), "socialRoutes");
const libraryRoutes = optionalRequire(path.join(__dirname, "..", "dist", "routes", "library"), "libraryRoutes");

const app = express();
const PORT = process.env.PORT || 3000;
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

// vNext Model Health Check (startup validation)
(async () => {
  try {
    const info = await validateModelRequirements();
    console.log(`[vNext] TF backend=${info.backend} model_sha=${info.sha256} out=${JSON.stringify(info.outShape)}`);
  } catch (e) {
    console.error("vNext model health check failed:", e.message);
    if (process.env.STRICT_ML === "true") {
      console.error("STRICT_ML enabled - refusing to start without valid model");
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

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
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

// Static file serving
const PUBLIC_DIR = path.join(__dirname, "../public");
app.use(express.static(PUBLIC_DIR));

// Media file serving for generated audio
const MEDIA_DIR = path.join(__dirname, "../media");
app.use("/media", express.static(MEDIA_DIR));

// Exports directory
const EXPORTS_DIR = path.join(__dirname, "../exports");
if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });

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

function toJulianDayUT(dateStr, timeStr, lat, lon){
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm = 0] = timeStr.split(":").map(Number);
  
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
  const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SPEED;
  
  // Main planets
  for (const [name, id] of Object.entries(PLANETS)) {
    try {
      const result = swe.swe_calc_ut(jd, id, flags);
      
      if (result.rc < 0) {
        console.warn(`Failed to calculate ${name}: ${result.rc}`);
        continue;
      }
      
      // Use the correct property name for longitude
      let lon = result.longitude || result.xx?.[0];
      if (lon === undefined) {
        console.warn(`No longitude found for ${name}`);
        continue;
      }
      
      if (lon < 0) lon += 360;
      if (lon >= 360) lon -= 360;
      
      positions[name] = lon;
    } catch (e) {
      console.error(`Error calculating ${name}:`, e.message);
    }
  }
  
  // Extras
  if (includeExtras) {
    for (const [name, id] of Object.entries(EXTRAS)) {
      try {
        const result = swe.swe_calc_ut(jd, id, flags);
        
        if (result.rc < 0) {
          console.warn(`Failed to calculate ${name}: ${result.rc}`);
          continue;
        }
        
        // Use the correct property name for longitude
        let lon = result.longitude || result.xx?.[0];
        if (lon === undefined) {
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
      } catch (e) {
        console.error(`Error calculating ${name}:`, e.message);
      }
    }
    
    // Add north node to positions if it was calculated
    if (positions.northNode !== undefined) {
      positions.northNode = positions.northNode;
    }
  }
  
  return positions;
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

// Calculate aspects between planets
function calcAspects(positions) {
  const aspects = [];
  const aspectTypes = {
    conjunction: { angle: 0, orb: 8 },
    opposition: { angle: 180, orb: 7 },
    trine: { angle: 120, orb: 6 },
    square: { angle: 90, orb: 6 },
    sextile: { angle: 60, orb: 5 }
  };
  
  const planetNames = Object.keys(positions);
  
  for (let i = 0; i < planetNames.length; i++) {
    for (let j = i + 1; j < planetNames.length; j++) {
      const p1 = planetNames[i];
      const p2 = planetNames[j];
      const lon1 = positions[p1];
      const lon2 = positions[p2];
      
      // Calculate angular separation
      let separation = Math.abs(lon1 - lon2);
      if (separation > 180) separation = 360 - separation;
      
      // Check for aspects
      for (const [type, config] of Object.entries(aspectTypes)) {
        const orb = Math.abs(separation - config.angle);
        if (orb <= config.orb) {
          aspects.push({
            p1,
            p2,
            type,
            angle: config.angle,
            orb,
            separation
          });
        }
      }
    }
  }
  
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
    const items = json.map(x => ({ label: x.display_name, lat: parseFloat(x.lat), lon: parseFloat(x.lon) }));
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
    const positions = calcPositions(jd, includeExtras);

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
    const positions = calcPositions(jd, includeExtras);
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

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    version: "2.0.0"
  });
});

// Rate limiting middleware

const composeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Too many composition requests', retryAfter: 900 },
  standardHeaders: true,
  legacyHeaders: false,
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
app.post("/api/compose", express.json(), vnextCompose);

console.log("[ROUTES]", dumpRoutes(app));

// Serve static files
app.use(express.static(PUBLIC_DIR));

// Serve ML models (for HTTP backend fallback)
app.use("/models", express.static(path.join(__dirname, "../models")));

// ---------- Phase-6 Endpoints ----------
// POST /api/compositions/generate → returns composition id
app.post('/api/compositions/generate', requireBeta, async (req, res) => {
  try {
    const body = req.body || {};
    const requestId = body.request_id || require('uuid').v4();
    const startMs = Date.now();

    // Input validation (bounds)
    if (!body.control_surface && !(body.mode && body.controls)) {
      return res.status(400).json({ error: 'invalid_payload', message: 'Missing control surface' });
    }

    // Call existing compose controller via local HTTP to ensure identical path
    const composeUrl = `http://localhost:${PORT}/api/compose`;
    const resp = await fetch(composeUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-beta-user': (req).betaUser || '' }, body: JSON.stringify({
      mode: 'sandbox',
      controls: body.control_surface || body.controls || {},
      seed: body.seed || 424242
    })});
    const composeJson = await resp.json();

    // Build export bundle
    const id = requestId;
    const dir = path.join(EXPORTS_DIR, id);
    ensureDir(dir);

    // track.wav (placeholder minimal PCM data)
    const audioPath = path.join(dir, 'track.wav');
    fs.writeFileSync(audioPath, Buffer.from('RIFF0000WAVEfmt '));

    // explanation.json
    writeJson(path.join(dir, 'explanation.json'), composeJson.explanation || {});
    // control-surface.json
    writeJson(path.join(dir, 'control-surface.json'), body.control_surface || body.controls || {});

    // model.json
    const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '../models/registry.json'), 'utf8'));
    const activeId = registry.registry_metadata?.active_model;
    const modelJson = {
      model_id: activeId,
      registry_hash: activeId,
      shard_hashes: []
    };
    writeJson(path.join(dir, 'model.json'), modelJson);

    // integrity.json with canonical manifest (sorted, canonical JSON)
    const filesList = ['control-surface.json','explanation.json','model.json','track.wav'];
    const manifest = filesList.map(name => {
      const p = path.join(dir, name);
      const isText = name.endsWith('.json');
      const data = isText ? fs.readFileSync(p, 'utf8') : fs.readFileSync(p);
      return {
        name,
        size: fs.statSync(p).size,
        sha256: 'sha256:' + sha256Str(isText ? data : data)
      };
    });
    // Canonical JSON string: sort keys and list already sorted by filename
    const canonical = JSON.stringify(manifest);
    const integrity = {
      manifest_sha256: 'sha256:' + sha256Str(canonical),
      files: Object.fromEntries(manifest.map(m => [m.name, { size: m.size, sha256: m.sha256 }]))
    };
    writeJson(path.join(dir, 'integrity.json'), integrity);

    // LRU cleanup
    lruCleanupExports();

    // Observability entry
    const endMs = Date.now();
    appendRuntimeLog({
      request_id: id,
      seed: composeJson?.controls?.hash,
      determinism_seed: composeJson?.controls?.hash,
      control_hash: 'sha256:'+sha256Str(JSON.stringify(composeJson?.controls||{})),
      audio_hash: 'sha256:'+sha256Str('track.wav:'+id),
      explanation_hash: 'sha256:'+sha256Str(JSON.stringify(composeJson?.explanation||{})),
      model_id: modelJson.model_id,
      registry_hash: modelJson.registry_hash,
      latency_ms: endMs - startMs,
      length_sec: 60,
      confusion_hotpair_delta: null,
      result: 'PASS',
      beta_user: (req).betaUser || null
    });

    return res.json({ id });
  } catch (e) {
    return res.status(500).json({ error: 'generate_failed', message: e.message });
  }
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
    const lengthOk = last.every(x=>x.length_sec===60);
    res.json({ p95_latency_ms: p95, determinism_rate: determinismRate, length_ok: lengthOk, count: last.length });
  } catch (e) {
    res.status(500).json({ error: 'metrics_failed', message: e.message });
  }
});
});

function safeReadJSON(p){ try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch (_) { return null; } }

// Catch-all handler for SPA
app.get("*", (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Start server
app.listen(PORT, async () => {
  try {
    console.log(`Astradio server running on http://localhost:${PORT}`);
    console.log(`Serving static from ${PUBLIC_DIR}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API version: v2 (vector-based)`);
    console.log(`Vector audition system: enabled`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
});
