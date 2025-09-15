const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Import Swiss Ephemeris functionality
const swe = require("swisseph");
const moment = require("moment-timezone");
const tzlookup = require("tzlookup");

const app = express();
const PORT = process.env.PORT || 3000;

// Basic CORS
app.use(cors());

// Add permissive CSP for audio development
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; worker-src 'self' blob:; connect-src 'self' https:;");
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving
const PUBLIC_DIR = path.join(__dirname, "../public");
app.use(express.static(PUBLIC_DIR));

// ---------- caches ----------
const respCache = new Map();     // positions/chart 60s
const geoCache  = new Map();     // geocode 5m
const TTL_POS_MS = 60_000;
const TTL_GEO_MS = 5 * 60_000;

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
  southNode: swe.SE_MEAN_NODE, // Will calculate opposite
  ceres: swe.SE_CERES,
  juno: swe.SE_JUNO,
  vesta: swe.SE_VESTA,
  pallas: swe.SE_PALLAS
};

// ---------- Utility functions ----------
function normalizeDate(dateStr) {
  if (!dateStr) return moment().format('YYYY-MM-DD');
  return moment(dateStr).format('YYYY-MM-DD');
}

function normalizeTime(timeStr) {
  if (!timeStr) return '12:00';
  return moment(timeStr, 'HH:mm').format('HH:mm');
}

function toJulianDayUT(dateStr, timeStr, lat = 0, lon = 0) {
  const date = moment.tz(dateStr + ' ' + timeStr, 'YYYY-MM-DD HH:mm', 'UTC');
  return date.valueOf() / 86400000 + 2440587.5;
}

function calcPositions(jd, includeExtras = true) {
  const positions = {};
  
  // Calculate main planets
  for (const [name, planet] of Object.entries(PLANETS)) {
    try {
      const result = swe.swe_calc_ut(jd, planet, swe.SEFLG_SWIEPH);
      positions[name] = result.longitude;
    } catch (e) {
      console.error(`Error calculating ${name}:`, e.message);
      positions[name] = 0;
    }
  }
  
  // Calculate extras if requested
  if (includeExtras) {
    for (const [name, planet] of Object.entries(EXTRAS)) {
      try {
        const result = swe.swe_calc_ut(jd, planet, swe.SEFLG_SWIEPH);
        if (name === 'southNode') {
          positions[name] = (result.longitude + 180) % 360;
        } else {
          positions[name] = result.longitude;
        }
      } catch (e) {
        console.error(`Error calculating ${name}:`, e.message);
        positions[name] = 0;
      }
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

// ---------- API Routes ----------

// Geocode (with cache)
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
    
    const jd = toJulianDayUT(date, time, lat, lon);
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

// Serve UI
app.get("*", (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Astradio server running on http://localhost:${PORT}`);
  console.log(`Serving static from ${PUBLIC_DIR}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`API version: v1`);
});
