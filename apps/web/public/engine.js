// ===================== Fetch + rules =====================
async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> ${r.status} ${await r.text().catch(()=> "")}`);
  return r.json();
}
async function getRules(){ return fetchJSON("./rules.json"); }

// Prefer /chart (if lat/lon). Fallback to /positions.
async function getSky(dateStr, timeStr, lat, lon) {
  const hasLoc = Number.isFinite(lat) && Number.isFinite(lon);
  const build = (base) => {
    const u = new URL(base, window.location.origin);
    if (dateStr) u.searchParams.set("date", dateStr);
    if (timeStr) u.searchParams.set("time", timeStr);
    if (hasLoc && base === "/chart") { u.searchParams.set("lat", lat); u.searchParams.set("lon", lon); }
    return u.toString();
  };
  if (hasLoc) {
    try { return await fetchJSON(build("/chart")); }
    catch { /* fall through to positions */ }
  }
  return fetchJSON(build("/positions"));
}

// ===================== Geocoder UI (restored) =====================
const placeEl = document.getElementById("place");
const latEl   = document.getElementById("lat");
const lonEl   = document.getElementById("lon");
const datalist = document.getElementById("places");

if (placeEl && latEl && lonEl && datalist) {
  const placeMap = new Map();

  function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }

  const searchPlaces = debounce(async (q)=>{
    if (!q || q.length < 2) { datalist.innerHTML = ""; return; }
    try{
      const items = await fetchJSON(`/geocode?q=${encodeURIComponent(q)}`);
      placeMap.clear();
      datalist.innerHTML = items.map(it=>{
        placeMap.set(it.label,{lat:it.lat,lon:it.lon});
        return `<option value="${it.label}"></option>`;
      }).join("");
    }catch(e){
      console.error("geocode", e);
      datalist.innerHTML = "";
    }
  }, 250);

  placeEl.addEventListener("input", e=>{
    const val = e.target.value.trim();
    const hit = placeMap.get(val);
    if (hit){
      latEl.value = String(hit.lat);
      lonEl.value = String(hit.lon);
    } else {
      latEl.value = "";
      lonEl.value = "";
      searchPlaces(val);
    }
  });
}

// ===================== Music helpers (theory-first) =====================
const A4 = 440;
const NOTE = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
function midiToFreq(m){ return A4 * Math.pow(2, (m-69)/12); }
function clamp(v,min,max){ return Math.min(max, Math.max(min, v)); }

const DEFAULT_SCALES = {
  ionian:        [0,2,4,5,7,9,11],       // major
  aeolian:       [0,2,3,5,7,8,10],       // natural minor
};
const DEFAULT_DIATONIC_QUAL = {
  major: ["maj7","min7","min7","maj7","dom7","min7","m7b5"],
  minor: ["min7","m7b5","maj7","min7","min7","maj7","dom7"]
};
const DEFAULT_QUAL_INTERVALS = {
  maj:   [0,4,7],
  min:   [0,3,7],
  dim:   [0,3,6],
  aug:   [0,4,8],
  dom7:  [0,4,7,10],
  maj7:  [0,4,7,11],
  min7:  [0,3,7,10],
  m7b5:  [0,3,6,10]
};

// Build scale (array of 7 pitch classes) from rules.theory.scales or defaults
function getScaleSemis(rules, modeOrName){
  const t = rules.theory?.scales || {};
  if (typeof modeOrName === "string") {
    const key = modeOrName.toLowerCase();
    if (Array.isArray(t[key])) return t[key].slice();
    if (key==="major") return (t.ionian||DEFAULT_SCALES.ionian).slice();
    if (key==="minor") return (t.aeolian||DEFAULT_SCALES.aeolian).slice();
  }
  // fallback by global mode later
  return null;
}

function buildScale(rootPC, scaleSemis){ // rootPC 0..11
  return scaleSemis.map(s => (rootPC + s) % 12);
}

// chord quality intervals
function qualIntervals(rules, qual){
  const q = rules.theory?.chordQualities?.[qual];
  if (Array.isArray(q)) return q.slice();
  return DEFAULT_QUAL_INTERVALS[qual] || DEFAULT_QUAL_INTERVALS.min;
}

// diatonic quality for degree (1..7) under "major"/"minor"
function diatonicQuality(rules, mode, degreeIdx0){
  const map = rules.theory?.diatonicQualities?.[mode] || DEFAULT_DIATONIC_QUAL[mode] || DEFAULT_DIATONIC_QUAL.major;
  return map[degreeIdx0 % 7] || "min7";
}

// Quantize + humanize
function q(timeSec, humanizeMs= (window.__astradio_humanize||18)){
  const bpm = Tone.Transport.bpm.value || 96;
  const grid = 60 / (bpm * 2); // 1/8th
  const qTime = Math.round(timeSec / grid) * grid;
  const jitter = (Math.random()*2 - 1) * (humanizeMs/1000);
  return qTime + jitter;
}

// Key from sky (may be overridden by houses[i].mode/scale)
function keyFromSky(positions){
  const sun = positions.sun ?? 0;
  const root = Math.round(sun/30) % 12;
  const moon = positions.moon ?? 0;
  const mode = (((moon - sun + 360) % 360) >= 0) ? "major" : "minor";
  return { root, mode };
}

function getCuspsFromResponse(chartJson){
  if (chartJson && Array.isArray(chartJson.cusps) && chartJson.cusps.length===12) {
    return chartJson.cusps.slice();
  }
  return Array.from({length:12},(_,i)=> i*30);
}
function houseOfDeg(deg, cusps){
  const d = ((deg%360)+360)%360;
  for (let i=0;i<12;i++){
    const a0 = cusps[i], a1 = cusps[(i+1)%12];
    if (a1 > a0){ if (d>=a0 && d<a1) return i; }
    else { if (d>=a0 || d<a1) return i; }
  }
  return 0;
}
function groupPlanetsByHouse(positions, cusps){
  const by = Array.from({length:12},()=>[]);
  for (const [name,deg] of Object.entries(positions)){
    if (typeof deg!=="number") continue;
    by[houseOfDeg(deg, cusps)].push(name);
  }
  return by;
}

// Aspect detection (uses rules.aspects as angle/orb, then maps to rules.aspectHarmonics if present)
function angleDiff(a,b){ return Math.abs(((a-b+540)%360)-180); } // 0..180
function normAspectName(n){
  const t = (n||"").toLowerCase();
  if (t.startsWith("conj")) return "conjunction";
  if (t === "opp" || t.startsWith("oppos")) return "opposition";
  return t;
}
function findAspects(positions, rules){
  const rulesAspects = rules.aspects||[];
  const names = Object.keys(positions);
  const res = [];
  for (let i=0;i<names.length;i++){
    for (let j=i+1;j<names.length;j++){
      const p1 = names[i], p2 = names[j];
      const A = positions[p1], B = positions[p2];
      if (typeof A!=="number"||typeof B!=="number") continue;
      const d = angleDiff(A,B);
      for (const asp of rulesAspects){
        if (Math.abs(d - asp.angle) <= asp.orb) {
          const key = normAspectName(asp.name);
          const harm = rules.aspectHarmonics?.[key] || {};
          res.push({ p1, p2, name: key, delta: d, effects: { ...(asp.effects||{}), ...(harm.effects||{}) } });
        }
      }
    }
  }
  return res;
}

// Voice leading
function voiceLead(prevMidiArr, nextMidiArr){
  if (!prevMidiArr || !prevMidiArr.length) return nextMidiArr.slice();
  const used = new Set();
  return nextMidiArr.map(target=>{
    let best = null, bestDist = 1e9, bestIdx = -1;
    for (let i=0;i<prevMidiArr.length;i++){
      if (used.has(i)) continue;
      const dist = Math.abs(prevMidiArr[i]-target);
      if (dist < bestDist){ best = prevMidiArr[i]; bestDist = dist; bestIdx = i; }
    }
    if (bestIdx >= 0) used.add(bestIdx);
    const step = clamp(target - best, -5, 5);
    return best + step;
  });
}

// Degree root MIDI from scale and base MIDI root (C4=60). degreeIdx0 0..6
function degreeRootMidi(baseMidiRoot, scalePCs, degreeIdx0){
  const pc = scalePCs[degreeIdx0 % 7];
  const rootPC = baseMidiRoot % 12;
  const diff = (pc - rootPC + 12) % 12;
  return baseMidiRoot + diff;
}

// ===================== Instruments & Mixer =====================
function getEnv(env){
  if (Array.isArray(env)) {
    const [attack=0.02,decay=0.2,sustain=0.6,release=0.25] = env;
    return { attack, decay, sustain, release };
  }
  const { attack=0.02,decay=0.2,sustain=0.6,release=0.25 } = env || {};
  return { attack, decay, sustain, release };
}
function buildMixer(rules){
  const mix = rules.extras?.mixer || {};
  const vol = Number.isFinite(mix.volumeDb) ? mix.volumeDb : -8;
  const revWet = Number.isFinite(rules.extras?.reverbWet) ? rules.extras.reverbWet : 0.2;
  const master = new Tone.Volume(vol).toDestination();
  const hpf  = new Tone.Filter(40, "highpass").connect(master);
  const comp = new Tone.Compressor({ threshold:-14, ratio:2, attack:0.03, release:0.25 }).connect(hpf);
  const lim  = new Tone.Limiter(-0.8).connect(comp);
  const reverb = new Tone.Reverb({ decay: 2.6, wet: revWet }).connect(lim);
  return { master, lim, reverb };
}
function mkSynth(osc, env, chain){
  const e0 = getEnv(env);
  const e = { attack: Math.max(0.01, e0.attack), decay: e0.decay, sustain: e0.sustain, release: Math.max(0.12, e0.release) };
  const s = new Tone.Synth({ oscillator:{ type:osc }, envelope: e });
  s.connect(chain);
  return s;
}
function buildInstruments(genreSpec, bus){
  const pad  = mkSynth(genreSpec.pad.osc,  genreSpec.pad.env,  bus.reverb);
  const lead = mkSynth(genreSpec.lead.osc, genreSpec.lead.env, bus.reverb);
  const bass = mkSynth(genreSpec.bass.osc, genreSpec.bass.env, bus.reverb);
  return { pad, lead, bass, bus };
}

// ===================== Segment composer (theory applied) =====================
const MAX_VOICES = 5;

function collectAspectEffects(aspects, planetsInHouse){
  // merge effects for any aspect touching a planet in this house
  const agg = { addIntervals: [], velScale: 1, invert:false, spread:0, octaveShift:0 };
  for (const a of aspects){
    if (!planetsInHouse.includes(a.p1) && !planetsInHouse.includes(a.p2)) continue;
    const e = a.effects||{};
    if (Array.isArray(e.addIntervals)) agg.addIntervals.push(...e.addIntervals);
    if (Number.isFinite(e.velScale)) agg.velScale *= e.velScale;
    if (e.invert) agg.invert = true;
    if (Number.isFinite(e.spread)) agg.spread = Math.max(agg.spread, e.spread);
    if (Number.isFinite(e.octaveShift)) agg.octaveShift += e.octaveShift;
  }
  return agg;
}

function scheduleHouseSegment(startSec, lengthSec, houseIdx, planetsInHouse, positions, rules, globalKey, theory, rack, intensity=100, prevChordRef){
  const houseDef = (rules.houses && rules.houses[houseIdx]) || {};
  const energy = clamp((houseDef.energy ?? 0.7) * (intensity/100), 0.2, 1);

  // Determine local mode/scale
  const localMode = (houseDef.mode==="major"||houseDef.mode==="minor") ? houseDef.mode : globalKey.mode;
  // root pitch-class for key
  const baseKeyRootPC = globalKey.root; // 0..11 from sun
  // scale semitones from theory or fallback by mode
  let scaleSemis =
    getScaleSemis(rules, houseDef.scale || localMode) ||
    (localMode==="major" ? (rules.theory?.scales?.ionian||DEFAULT_SCALES.ionian)
                         : (rules.theory?.scales?.aeolian||DEFAULT_SCALES.aeolian));
  const scalePCs = buildScale(baseKeyRootPC, scaleSemis);

  // Progression degree for this house
  const prog = theory.progressions?.houseCycle; // array of degrees 1..7
  const deg1 = Array.isArray(prog) && prog.length>=12 ? prog[houseIdx] : null;
  const degreeIdx0 = Number.isFinite(deg1) ? ((deg1-1+7)%7) : [0,4,5,1,6,3,4,1,2,0,1,5][houseIdx%12]; // default: I–V–VI–II–VII–IV–V…

  // Diatonic chord quality (or explicit override from theory.map?)
  const qual = (theory.degreeQualities?.[localMode]?.[degreeIdx0]) || diatonicQuality(rules, localMode, degreeIdx0);
  // Root MIDI (C4=60 based)
  const baseMidiRoot = 60 + baseKeyRootPC; // key center around C4
  let chordRootMidi = degreeRootMidi(baseMidiRoot, scalePCs, degreeIdx0);

  // Build chord intervals from quality
  let chordSemis = qualIntervals(rules, qual);

  // Aspect-driven alterations
  const aspectMods = collectAspectEffects(findAspects(positions, rules), planetsInHouse);
  if (aspectMods.addIntervals.length){
    chordSemis = Array.from(new Set([...chordSemis, ...aspectMods.addIntervals]));
  }
  if (aspectMods.invert){
    // simple 1st inversion: move root up an octave
    chordRootMidi += 12;
  }
  if (aspectMods.octaveShift){
    chordRootMidi += 12 * Math.round(aspectMods.octaveShift);
  }

  // Build chord MIDI notes
  let chordMidi = chordSemis.map(s => chordRootMidi + s);

  // Voice-leading vs previous
  chordMidi = voiceLead(prevChordRef.value, chordMidi);
  prevChordRef.value = chordMidi.slice();

  // Register allocation
  const padMidis = chordMidi.map(n => clamp(n, 48, 80));                // mid
  const bassMidi = clamp(Math.min(...chordMidi) - 12, 36, 55);          // low
  const leadSeed = clamp(Math.max(...padMidis) + 12, 60, 92);           // high

  const velScale = clamp(aspectMods.velScale, 0.4, 1.6);
  const spread = clamp(aspectMods.spread || 0, 0, 12);

  let voices = 0;

  // PAD sustain (slightly widened)
  Tone.Transport.schedule((time) => {
    if (voices < MAX_VOICES){
      const padFreqs = padMidis.map(m => midiToFreq(m));
      rack.pad.triggerAttackRelease(padFreqs, lengthSec-0.05, q(time, 14), 0.55*energy*velScale);
      voices += 1;
    }
  }, startSec);

  // BASS two notes
  for (let i=0;i<2;i++){
    const t = startSec + i*(lengthSec/2);
    Tone.Transport.schedule((time)=>{
      if (voices < MAX_VOICES){
        rack.bass.triggerAttackRelease(midiToFreq(bassMidi), 0.35, q(time, 10), 0.8*energy*velScale);
        voices += 1;
      }
    }, t);
  }

  // LEAD: diatonic arpeggio over chord tones with small leaps + spread
  const steps = Math.floor(lengthSec / 0.125);
  for (let s=0;s<steps;s++){
    const t = startSec + s*0.125;
    Tone.Transport.schedule((time)=>{
      if (voices < MAX_VOICES){
        const idx = s % padMidis.length;
        let note = padMidis[idx] + (s%4===0 ? 12 : 0) + (spread ? ((s%8<4)?spread:0) : 0);
        note = clamp(note, 58, 96);
        rack.lead.triggerAttackRelease(midiToFreq(note), 0.09, q(time, 16), 0.35*energy*velScale);
        voices += 1;
      }
    }, t);
  }
}

// ===================== Main play (12×segSec) — with wheel highlight =====================
async function playWheel() {
  const dateEl = document.getElementById("date");
  const timeEl = document.getElementById("time");
  const statusEl = document.getElementById("status");
  const genreEl = document.getElementById("genre");
  const intensityEl = document.getElementById("intensity");

  const dateStr = dateEl?.value || new Date().toISOString().slice(0,10);
  const timeStr = timeEl?.value || "12:00";
  const lat = parseFloat(document.getElementById("lat")?.value);
  const lon = parseFloat(document.getElementById("lon")?.value);

  const rules = await getRules();
  const theory = rules.theory || {};
  const data  = await getSky(dateStr, timeStr, lat, lon);
  const positions = data.positions || {};
  const cusps = getCuspsFromResponse(data);
  const key = keyFromSky(positions);

  // Render/refresh wheel and start with House 1 highlighted
  Wheel.setData(positions, cusps);
  Wheel.highlight(0);

  const genreKey = (genreEl?.value)||"ambient";
  const genreSpec = (rules.genres && rules.genres[genreKey]) || rules.genres.ambient;

  // Mixer + instruments
  const bus  = buildMixer(rules);
  const rack = buildInstruments(genreSpec, bus);

  const byHouse = groupPlanetsByHouse(positions, cusps);
  const segSec = rules.segmentSeconds || 5;
  const totalSec = segSec * 12;

  Tone.Transport.stop();
  Tone.Transport.cancel();
  Tone.Transport.bpm.value = clamp(rules.tempo || 96, 60, 140);

  const prevChordRef = { value: [] };

  for (let h=0; h<12; h++){
    const start = h * segSec;
    scheduleHouseSegment(
      start, segSec, h,
      byHouse[h], positions, rules, key, theory, rack,
      parseFloat(intensityEl?.value||100), prevChordRef
    );

    // UI label
    const houseDef = (rules.houses && rules.houses[h]) || {};
    const label = houseDef.name ? `${houseDef.name}` : `House ${h+1}`;
    const motif = houseDef.motif ? ` • ${houseDef.motif}` : "";
    Tone.Transport.schedule(()=>{
      const names = byHouse[h].length ? byHouse[h].join(", ") : "neutral motif";
      const modeStr = (houseDef.scale || houseDef.mode || key.mode);
      const keyStr = `Key ${NOTE[key.root]} ${typeof modeStr === "string" ? modeStr : key.mode}`;
      statusEl.textContent = `${label}${motif} • ${names} • ${keyStr}`;
      Wheel.highlight(h);
    }, start);
  }

  await Tone.start();
  Tone.Transport.start("+0.08");

  Tone.Transport.scheduleOnce(()=>{
    Tone.Transport.stop();
    statusEl.textContent = `Sequence complete (${totalSec}s).`;
    Wheel.highlight(0);
  }, totalSec + 0.1);
}

// ===================== Buttons =====================
document.getElementById("start").addEventListener("click", ()=>{
  playWheel().catch(e=>{
    const statusEl = document.getElementById("status");
    statusEl.textContent = `Error: ${e.message}`;
    console.error(e);
  });
});
document.getElementById("stop").addEventListener("click", ()=> Tone.Transport.stop());
