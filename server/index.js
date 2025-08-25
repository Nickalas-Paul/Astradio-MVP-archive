const path = require("path");
const express = require("express");
const cors = require("cors");
const Astro = require("astronomy-engine");

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, "../public");
app.use(cors());
app.use(express.static(PUBLIC_DIR));

// ---------- caches ----------
const respCache = new Map();     // positions/chart 60s
const geoCache  = new Map();     // geocode 5m
const TTL_POS_MS = 60_000;
const TTL_GEO_MS = 5 * 60_000;

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
function toDateUTC(dateStr, timeStr){
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, mo-1, d, hh||0, mm||0, 0));
}

// ecliptic longitude 0..360 for a body using astronomy-engine (geocentric, of-date)
function eclLon(body, date){
  const vec = Astro.GeoVector(body, date, /* ofDate */ true);
  const ecl = Astro.Ecliptic(vec);    // degrees
  let L = ecl.elon % 360;
  if (L < 0) L += 360;
  return L;
}
const BODIES = {
  sun: Astro.Body.Sun,
  moon: Astro.Body.Moon,
  mercury: Astro.Body.Mercury,
  venus: Astro.Body.Venus,
  mars: Astro.Body.Mars,
  jupiter: Astro.Body.Jupiter,
  saturn: Astro.Body.Saturn,
  uranus: Astro.Body.Uranus,
  neptune: Astro.Body.Neptune,
  pluto: Astro.Body.Pluto
};
function calcPositions(date){
  const positions = {};
  for (const [name, body] of Object.entries(BODIES)){
    positions[name] = eclLon(body, date);
  }
  return positions;
}

// ---------- API ----------

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
      "User-Agent": "Astradio/1.0 (astradio.io; contact: support@astradio.io)"
,
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
    const key = `pos|${date}|${time}`;
    const hit = respCache.get(key);
    const now = Date.now();
    if (hit && (now - hit.t) < TTL_POS_MS) {
      return res.json({ date, time, positions: hit.positions, cusps: hit.cusps, cached: true });
    }
    const dt = toDateUTC(date, time);
    const positions = calcPositions(dt);

    // Equal-house cusps (reliable interim; Placidus coming next)
    const cusps = Array.from({length:12},(_,i)=> i*30);

    respCache.set(key, { t: now, positions, cusps });
    res.json({ date, time, positions, cusps, cached: false });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// Chart with location — for now returns same positions + equal cusps.
// (We’ll replace cusps with real **Placidus** values in a follow-up.)
app.get("/chart", (req, res) => {
  try {
    const date = normalizeDate(req.query.date);
    const time = normalizeTime(req.query.time || "12:00");
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const key = `chart|${date}|${time}|${lat}|${lon}`;
    const hit = respCache.get(key);
    const now = Date.now();
    if (hit && (now - hit.t) < TTL_POS_MS) return res.json(hit.payload);

    const dt = toDateUTC(date, time);
    const positions = calcPositions(dt);

    const payload = {
      date, time, lat, lon,
      positions,
      // Equal-house placeholder. We will compute true Placidus cusps next.
      cusps: Array.from({length:12},(_,i)=> i*30),
      cached: false
    };
    respCache.set(key, { t: now, payload });
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// Serve UI
app.get("*", (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Astradio server running on http://localhost:${PORT}`);
  console.log(`Serving static from ${PUBLIC_DIR}`);
});
