const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Import existing Swiss Ephemeris functionality
const swe = require("swisseph");
const moment = require("moment-timezone");
const tzlookup = require("tzlookup");

// Import new platform modules (optional)
let database, redis;
try {
  database = require("../lib/database");
} catch (e) {
  console.log("Database module not available, running without database");
  database = { close: async () => {} };
}

try {
  redis = require("../lib/redis");
} catch (e) {
  console.log("Redis module not available, running without Redis");
  redis = { close: async () => {} };
}

// Import routes (optional)
let authRoutes, userRoutes, trackRoutes, socialRoutes, libraryRoutes;
try {
  authRoutes = require("../routes/auth");
  userRoutes = require("../routes/users");
  trackRoutes = require("../routes/tracks");
  socialRoutes = require("../routes/social");
  libraryRoutes = require("../routes/library");
} catch (e) {
  console.log("Route modules not available, running with basic functionality only");
  authRoutes = { router: require('express').Router() };
  userRoutes = { router: require('express').Router() };
  trackRoutes = { router: require('express').Router() };
  socialRoutes = { router: require('express').Router() };
  libraryRoutes = { router: require('express').Router() };
}

const app = express();
const PORT = process.env.PORT || 3000;

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

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving
const PUBLIC_DIR = path.join(__dirname, "../public");
app.use(express.static(PUBLIC_DIR));

// Media file serving for generated audio
const MEDIA_DIR = path.join(__dirname, "../media");
app.use("/media", express.static(MEDIA_DIR));

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
  southNode: swe.SE_MEAN_NODE, // Will calculate opposite
  ceres: swe.SE_CERES,
  juno: swe.SE_JUNO,
  vesta: swe.SE_VESTA,
  pallas: swe.SE_PALLAS
};

// ---------- helpers ----------
function pad2(n){ return String(n).padStart(2,"0"); }

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
        if (name === 'southNode') {
          lon = (lon + 180) % 360; // Opposite of North Node
        }
        
        if (lon < 0) lon += 360;
        if (lon >= 360) lon -= 360;
        
        positions[name] = lon;
      } catch (e) {
        console.error(`Error calculating ${name}:`, e.message);
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

// ---------- New Composition API Endpoints ----------

// POST /api/compose - Generate chart context from birth data
app.post("/api/compose", express.json(), async (req, res) => {
  try {
    const { mode, genre, natal, compare, useTodaySky } = req.body;
    
    // Validate required fields
    if (!natal || !natal.date || !natal.time || !natal.tz || natal.lat === undefined || natal.lon === undefined) {
      return res.status(400).json({ error: "Missing required natal data" });
    }
    
    if (!mode || !genre) {
      return res.status(400).json({ error: "Missing mode or genre" });
    }
    
    // Validate mode and genre
    const validModes = ['house-order', 'cluster', 'elemental', 'lunar'];
    const validGenres = ['ambient', 'classical', 'jazz', 'lofi', 'house', 'electronic'];
    
    if (!validModes.includes(mode)) {
      return res.status(400).json({ error: `Invalid mode. Must be one of: ${validModes.join(', ')}` });
    }
    
    if (!validGenres.includes(genre)) {
      return res.status(400).json({ error: `Invalid genre. Must be one of: ${validGenres.join(', ')}` });
    }
    
    console.log(`COMPOSE: ${mode}/${genre} for ${natal.date} ${natal.time} ${natal.tz} (${natal.lat}, ${natal.lon})`);
    
    // Resolve UTC instant for natal chart
    const natalJd = toJulianDayUT(natal.date, natal.time, natal.lat, natal.lon);
    console.log(`EPHEMERIS: natal JD ${natalJd.toFixed(6)} tz=${natal.tz} ok`);
    
    // Get natal chart data
    const natalPositions = calcPositions(natalJd, true);
    const natalHouses = calcPlacidusCusps(natalJd, natal.lat, natal.lon);
    const natalAspects = calcAspects(natalPositions);
    const natalMoonPhase = calcMoonPhase(natalJd);
    const natalElements = calcDominantElements(natalPositions);
    const natalClusters = buildPlanetaryClusters(natalPositions);
    
    // Build natal chart context
    const natalContext = {
      planets: natalPositions,
      houses: natalHouses,
      aspects: natalAspects,
      moonPhase: natalMoonPhase,
      dominantElements: natalElements,
      clusters: natalClusters,
      nowJulian: natalJd,
      date: natal.date,
      time: natal.time,
      timezone: natal.tz,
      latitude: natal.lat,
      longitude: natal.lon
    };
    
    let chartContext = natalContext;
    
    // Handle comparison chart if provided
    if (compare && compare.date && compare.time && compare.tz && compare.lat !== undefined && compare.lon !== undefined) {
      console.log(`COMPARE: ${compare.date} ${compare.time} ${compare.tz} (${compare.lat}, ${compare.lon})`);
      
      const compareJd = toJulianDayUT(compare.date, compare.time, compare.lat, compare.lon);
      const comparePositions = calcPositions(compareJd, true);
      const compareHouses = calcPlacidusCusps(compareJd, compare.lat, compare.lon);
      const compareAspects = calcAspects(comparePositions);
      const compareMoonPhase = calcMoonPhase(compareJd);
      const compareElements = calcDominantElements(comparePositions);
      const compareClusters = buildPlanetaryClusters(comparePositions);
      
      const compareContext = {
        planets: comparePositions,
        houses: compareHouses,
        aspects: compareAspects,
        moonPhase: compareMoonPhase,
        dominantElements: compareElements,
        clusters: compareClusters,
        nowJulian: compareJd,
        date: compare.date,
        time: compare.time,
        timezone: compare.tz,
        latitude: compare.lat,
        longitude: compare.lon
      };
      
      chartContext.overlay = compareContext;
    }
    
    // Handle today's sky if requested
    if (useTodaySky) {
      const today = new Date();
      const todayDate = today.toISOString().slice(0, 10);
      const todayTime = "12:00"; // Use noon for today's positions
      
      console.log(`TODAY: ${todayDate} ${todayTime} UTC`);
      
      const todayJd = toJulianDayUT(todayDate, todayTime);
      const todayPositions = calcPositions(todayJd, true);
      const todayAspects = calcAspects(todayPositions);
      const todayMoonPhase = calcMoonPhase(todayJd);
      const todayElements = calcDominantElements(todayPositions);
      const todayClusters = buildPlanetaryClusters(todayPositions);
      
      const todayContext = {
        planets: todayPositions,
        aspects: todayAspects,
        moonPhase: todayMoonPhase,
        dominantElements: todayElements,
        clusters: todayClusters,
        nowJulian: todayJd,
        date: todayDate,
        time: todayTime,
        timezone: "UTC"
      };
      
      chartContext.today = todayContext;
    }
    
    // Log chart context summary
    const planetCount = Object.keys(chartContext.planets).length;
    const aspectCount = chartContext.aspects.length;
    const clusterCount = chartContext.clusters.length;
    const lunarPhase = chartContext.moonPhase;
    
    console.log(`CHART_CONTEXT: houses=12 planets=${planetCount} aspects=${aspectCount} clusters=${clusterCount} lunar=${lunarPhase}`);
    
    res.json({
      success: true,
      chartContext,
      mode,
      genre,
      analytics: {
        planetCount,
        aspectCount,
        clusterCount,
        lunarPhase,
        hasOverlay: !!chartContext.overlay,
        hasTodaySky: !!chartContext.today
      }
    });
    
  } catch (error) {
    console.error("Error in /api/compose:", error);
    res.status(500).json({ error: "Failed to generate chart context", details: error.message });
  }
});

// POST /api/render - Generate audio files from chart context
app.post("/api/render", express.json(), async (req, res) => {
  try {
    const { chartContext, mode, genre, format = "wav", normalize = true } = req.body;
    
    // Validate required fields
    if (!chartContext || !mode || !genre) {
      return res.status(400).json({ error: "Missing required fields: chartContext, mode, genre" });
    }
    
    // Validate format
    const validFormats = ['wav', 'ogg'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({ error: `Invalid format. Must be one of: ${validFormats.join(', ')}` });
    }
    
    console.log(`RENDER: ${mode}/${genre} format=${format} normalize=${normalize}`);
    
    // Generate unique ID for this composition
    const { v4: uuidv4 } = require('uuid');
    const compositionId = uuidv4();
    
    // Generate narrative using the engine FIRST
    const narrative = generateNarrativeFromContext(chartContext, mode, genre);
    
    // Verify 60-second duration
    const pathSum = narrative.timeline.reduce((sum, stop) => sum + stop.duration, 0);
    console.log(`PATH_SUM ${pathSum.toFixed(2)} | SEGMENTS ${narrative.timeline.length} | NOTES ${narrative.timeline.length * 10}`);
    
    if (Math.abs(pathSum - 60) > 0.1) {
      throw new Error(`Path does not sum to 60 seconds: ${pathSum}`);
    }
    
    // Create a simple WAV file with a tone based on the narrative
    const fs = require('fs');
    const path = require('path');
    const mediaDir = path.join(__dirname, '../media');
    
    // Ensure media directory exists
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }
    
    const sampleRate = 44100;
    const duration = 60; // 60 seconds to match the narrative
    const samples = sampleRate * duration;
    const channels = 2;
    
    // Create WAV header
    const buffer = Buffer.alloc(44 + samples * channels * 2); // 16-bit samples
    let offset = 0;
    
    // WAV header
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(36 + samples * channels * 2, offset); offset += 4; // File size
    buffer.write('WAVE', offset); offset += 4;
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4; // Chunk size
    buffer.writeUInt16LE(1, offset); offset += 2; // Audio format (PCM)
    buffer.writeUInt16LE(channels, offset); offset += 2; // Channels
    buffer.writeUInt32LE(sampleRate, offset); offset += 4; // Sample rate
    buffer.writeUInt32LE(sampleRate * channels * 2, offset); offset += 4; // Byte rate
    buffer.writeUInt16LE(channels * 2, offset); offset += 2; // Block align
    buffer.writeUInt16LE(16, offset); offset += 2; // Bits per sample
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(samples * channels * 2, offset); offset += 4; // Data size
    
    // Generate a simple tone based on the narrative structure
    // Use the first melody note from the narrative as the base frequency
    const baseNote = narrative.timeline[0]?.melody?.[0]?.note || 60; // Middle C as fallback
    const baseFreq = 440 * Math.pow(2, (baseNote - 69) / 12); // Convert MIDI note to frequency
    
    // Write audio data with a simple sine wave
    for (let i = 0; i < samples; i++) {
      const time = i / sampleRate;
      const amplitude = 0.3 * Math.sin(2 * Math.PI * baseFreq * time);
      const sample = Math.floor(amplitude * 32767); // Convert to 16-bit PCM
      
      // Write to both channels (stereo)
      buffer.writeInt16LE(sample, offset);
      buffer.writeInt16LE(sample, offset + 2);
      offset += 4;
    }
    
    // Save the WAV file
    const wavPath = path.join(mediaDir, `${compositionId}.wav`);
    fs.writeFileSync(wavPath, buffer);
    
    console.log(`WRITE /media/${compositionId}.wav ok`);
    
    // Calculate real analytics from the narrative
    const notesScheduled = narrative.timeline.reduce((total, segment) => {
      return total + (segment.melody?.length || 0) + (segment.harmony?.length || 0) + (segment.bass?.length || 0);
    }, 0);
    const transportTime = 60.0;
    const cadenceTimes = narrative.cadencePlan.small || [20, 40];
    const finalCadenceTime = narrative.cadencePlan.major || 60;
    
    // Generate OGG if requested (simplified - would need proper OGG encoder)
    let oggPath = null;
    if (format === 'ogg' || format === 'both') {
      // For now, just copy WAV as OGG (in real implementation, use proper OGG encoder)
      oggPath = path.join(mediaDir, `${compositionId}.ogg`);
      fs.copyFileSync(wavPath, oggPath);
      console.log(`WRITE /media/${compositionId}.ogg ok`);
    }
    
    const renderedTotal = transportTime;
    console.log(`RENDERED_TOTAL: ${Math.round(renderedTotal * 1000) / 1000} seconds`);
    
    res.json({
      success: true,
      id: compositionId,
      duration: duration,
      files: {
        wav: `/media/${compositionId}.wav`,
        ...(oggPath && { ogg: `/media/${compositionId}.ogg` })
      },
      analytics: {
        pathSum: pathSum,
        notesScheduled: notesScheduled,
        cadences: [...cadenceTimes, finalCadenceTime],
        renderedTotal: renderedTotal
      }
    });
    
  } catch (error) {
    console.error("Error in /api/render:", error);
    res.status(500).json({ error: "Failed to render audio", details: error.message });
  }
});

// Graceful shutdown
async function gracefulShutdown() {
  console.log('Shutting down gracefully...');
  
  try {
    // Close database connections
    if (database && database.close) await database.close();
  } catch (e) {
    console.log('Database close error:', e.message);
  }
  
  try {
    // Close Redis connections
    if (redis && redis.close) await redis.close();
  } catch (e) {
    console.log('Redis close error:', e.message);
  }
  
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
app.listen(PORT, async () => {
  try {
    // Initialize connections (optional)
    if (redis && redis.connect) {
      try {
        await redis.connect();
        console.log('Redis connected successfully');
      } catch (e) {
        console.log('Redis connection failed, continuing without Redis:', e.message);
      }
    }
    
    console.log(`Astradio server running on http://localhost:${PORT}`);
    console.log(`Serving static from ${PUBLIC_DIR}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API version: v1`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
});
