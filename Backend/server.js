const path = require("path");
const express = require("express");
const cors = require("cors");
const swe = require("swisseph");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Static frontend --------------------------------------------------------
const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR));
app.use(cors());

// ---- IP Geolocation API ----------------------------------------------------
// Free IP geolocation service (ipapi.co)
async function getLocationFromIP(ip) {
  return new Promise((resolve, reject) => {
    // Use a public IP geolocation service
    const url = `https://ipapi.co/${ip}/json/`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const location = JSON.parse(data);
          
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
        } catch (error) {
          reject(new Error(`Failed to parse location data: ${error.message}`));
        }
      });
    }).on('error', (error) => {
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

// Geolocation endpoint
app.get("/geolocation", async (req, res) => {
  try {
    const clientIP = getClientIP(req);
    
    // Skip geolocation for localhost/private IPs
    if (clientIP === '127.0.0.1' || clientIP === '::1' || clientIP.startsWith('192.168.') || clientIP.startsWith('10.')) {
      return res.json({
        success: false,
        error: 'Local IP detected',
        fallback: {
          city: 'New York',
          region: 'NY',
          country: 'United States',
          latitude: 40.7128,
          longitude: -74.0060,
          timezone: 'America/New_York',
          utc_offset: '-05:00'
        }
      });
    }
    
    const location = await getLocationFromIP(clientIP);
    
    res.json({
      success: true,
      ip: clientIP,
      location: location
    });
    
  } catch (error) {
    console.error('Geolocation error:', error.message);
    
    // Return fallback data on error
    res.json({
      success: false,
      error: error.message,
      fallback: {
        city: 'New York',
        region: 'NY',
        country: 'United States',
        latitude: 40.7128,
        longitude: -74.0060,
        timezone: 'America/New_York',
        utc_offset: '-05:00'
      }
    });
  }
});

// ---- Swiss Ephemeris positions API -----------------------------------------
// If you have local ephemeris .se1 files, point to the folder like:
// swe.swe_set_ephe_path(path.join(__dirname, "ephe"));

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

// small in-memory cache (60s)
const cache = new Map();
const TTL_MS = 60_000;

function toJulianDayUT(dateStr, timeStr = "12:00") {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm = 0] = timeStr.split(":").map(Number);
  const ut = hh + mm / 60;
  return swe.swe_julday(y, m, d, ut, swe.SE_GREG_CAL);
}

app.get("/positions", (req, res) => {
  try {
    const date = (req.query.date || new Date().toISOString().slice(0, 10));
    const time = (req.query.time || "12:00");
    const key = `${date}|${time}`;

    const hit = cache.get(key);
    const now = Date.now();
    if (hit && (now - hit.t) < TTL_MS) {
      return res.json({ date, time, positions: hit.positions, cached: true });
    }

    const jd = toJulianDayUT(date, time);
    const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SPEED;
    const positions = {};
    for (const [name, id] of Object.entries(PLANETS)) {
      const result = swe.swe_calc_ut(jd, id, flags);
      if (result.rc < 0) throw new Error(`calc failed for ${name}`);
      // Handle both old format (result.xx array) and new format (result object with longitude)
      if (result.xx && Array.isArray(result.xx) && result.xx.length > 0) {
        positions[name] = result.xx[0]; // longitude 0..360
      } else if (result.longitude !== undefined) {
        positions[name] = result.longitude; // longitude 0..360
      } else {
        throw new Error(`Invalid result format for ${name}: ${JSON.stringify(result)}`);
      }
    }

    cache.set(key, { t: now, positions });
    res.json({ date, time, positions, cached: false });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// Chart endpoint with house cusps
app.get("/chart", (req, res) => {
  try {
    const date = (req.query.date || new Date().toISOString().slice(0, 10));
    const time = (req.query.time || "12:00");
    const lat = parseFloat(req.query.lat) || 0;
    const lon = parseFloat(req.query.lon) || 0;
    
    const jd = toJulianDayUT(date, time);
    const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SPEED;
    
    // Get planet positions
    const positions = {};
    for (const [name, id] of Object.entries(PLANETS)) {
      const result = swe.swe_calc_ut(jd, id, flags);
      if (result.rc < 0) throw new Error(`calc failed for ${name}`);
      if (result.xx && Array.isArray(result.xx) && result.xx.length > 0) {
        positions[name] = result.xx[0]; // longitude 0..360
      } else if (result.longitude !== undefined) {
        positions[name] = result.longitude; // longitude 0..360
      } else {
        throw new Error(`Invalid result format for ${name}: ${JSON.stringify(result)}`);
      }
    }
    
    // Calculate house cusps (simplified - using equal house system)
    const cusps = [];
    for (let i = 0; i < 12; i++) {
      cusps.push(i * 30); // Equal house system
    }
    
    res.json({ 
      date, 
      time, 
      positions, 
      cusps,
      cached: false 
    });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// Auto-chart endpoint that combines geolocation with chart generation
app.get("/auto-chart", async (req, res) => {
  try {
    const clientIP = getClientIP(req);
    let location;
    
    // Try to get location from IP
    try {
      if (clientIP === '127.0.0.1' || clientIP === '::1' || clientIP.startsWith('192.168.') || clientIP.startsWith('10.')) {
        // Use fallback for local IPs
        location = {
          city: 'New York',
          region: 'NY',
          country: 'United States',
          latitude: 40.7128,
          longitude: -74.0060,
          timezone: 'America/New_York',
          utc_offset: '-05:00'
        };
      } else {
        location = await getLocationFromIP(clientIP);
      }
    } catch (error) {
      // Use fallback on geolocation error
      location = {
        city: 'New York',
        region: 'NY',
        country: 'United States',
        latitude: 40.7128,
        longitude: -74.0060,
        timezone: 'America/New_York',
        utc_offset: '-05:00'
      };
    }
    
    // Get current time in user's timezone
    const now = new Date();
    const userTime = new Date(now.toLocaleString("en-US", {timeZone: location.timezone}));
    const date = userTime.toISOString().slice(0, 10);
    const time = userTime.toTimeString().slice(0, 5);
    
    // Generate chart for current time and location
    const jd = toJulianDayUT(date, time);
    const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SPEED;
    
    // Get planet positions
    const positions = {};
    for (const [name, id] of Object.entries(PLANETS)) {
      const result = swe.swe_calc_ut(jd, id, flags);
      if (result.rc < 0) throw new Error(`calc failed for ${name}`);
      if (result.xx && Array.isArray(result.xx) && result.xx.length > 0) {
        positions[name] = result.xx[0]; // longitude 0..360
      } else if (result.longitude !== undefined) {
        positions[name] = result.longitude; // longitude 0..360
      } else {
        throw new Error(`Invalid result format for ${name}: ${JSON.stringify(result)}`);
      }
    }
    
    // Calculate house cusps (simplified - using equal house system)
    const cusps = [];
    for (let i = 0; i < 12; i++) {
      cusps.push(i * 30); // Equal house system
    }
    
    res.json({ 
      success: true,
      date, 
      time, 
      location,
      positions, 
      cusps,
      cached: false 
    });
  } catch (e) {
    res.status(500).json({ 
      success: false,
      error: e.message || String(e) 
    });
  }
});

// fallback to index.html for root
app.get("*", (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Astradio server running on http://localhost:${PORT}`);
  console.log(`Static files: ${PUBLIC_DIR}`);
});
