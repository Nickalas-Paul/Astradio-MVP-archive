const path = require("path");
const express = require("express");
const cors = require("cors");
const swe = require("swisseph");

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Static frontend --------------------------------------------------------
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));
app.use(cors());

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
      positions[name] = result.xx[0]; // longitude 0..360
    }

    cache.set(key, { t: now, positions });
    res.json({ date, time, positions, cached: false });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
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
