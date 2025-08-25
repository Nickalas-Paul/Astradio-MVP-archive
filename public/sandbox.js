// blank chart by default + very light controls (mobile-first)
const genreSel = document.getElementById("genre");
genreSel.value = localStorage.getItem("genre") || "ambient";
genreSel.addEventListener("change", ()=> localStorage.setItem("genre", genreSel.value));

let positions = {};                          // starts empty
let cusps = Array.from({length:12},(_,i)=> i*30);

window.addEventListener("load", () => {
  Wheel.setData(positions, cusps);           // blank wheel
});

async function fetchJSON(url){ const r=await fetch(url); if(!r.ok) throw new Error(); return r.json(); }

document.getElementById("addToday").addEventListener("click", async ()=>{
  const data = await fetchJSON("/positions");
  positions = { ...positions, ...data.positions };
  Wheel.setData(positions, cusps);
});

document.getElementById("addNatal").addEventListener("click", ()=>{
  alert("Natal loader TBD — will use a small modal next pass.");
});

document.getElementById("addCustom").addEventListener("click", ()=>{
  // quick demo: drop a random dot
  const name = `pt_${Math.random().toString(36).slice(2,6)}`;
  positions[name] = Math.random()*360;
  Wheel.setData(positions, cusps);
});

document.getElementById("randomize").addEventListener("click", ()=>{
  Object.keys(positions).forEach(k => positions[k] = Math.random()*360);
  Wheel.setData(positions, cusps);
});

document.getElementById("reset").addEventListener("click", ()=>{
  positions = {};
  Wheel.setData(positions, cusps);
});

document.getElementById("start").addEventListener("click", ()=>{
  // stub: reuse a tiny pad so users hear something; full engine comes later
  const A4=440, midiToFreq=(m)=> A4*Math.pow(2,(m-69)/12);
  const pad = new Tone.Synth({ oscillator:{type:"sine"}, envelope:{attack:.02,decay:.2,sustain:.6,release:.25} }).toDestination();
  Tone.Transport.stop(); Tone.Transport.cancel(); Tone.Transport.bpm.value=96;
  for(let h=0;h<12;h++){
    const start=h*0.75; const note=midiToFreq(60 + (h%7));
    Tone.Transport.schedule((t)=>{ pad.triggerAttackRelease(note,0.6,t,0.4); Wheel.highlight(h); }, start);
  }
  Tone.start().then(()=> Tone.Transport.start("+0.05"));
});
document.getElementById("stop").addEventListener("click", ()=> Tone.Transport.stop());
