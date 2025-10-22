// ---- shared helpers ----
async function fetchJSON(url){ const r=await fetch(url); if(!r.ok) throw new Error(`${url} -> ${r.status}`); return r.json(); }
async function getRules(){ return fetchJSON("./rules.json"); }
function pad2(n){ return String(n).padStart(2,"0"); }
function normalizeDate(s){ if(!s) return new Date().toISOString().slice(0,10);
  const m=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s); if(m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`;
  const d=new Date(s); if(!isNaN(d)) return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth()+1)}-${pad2(d.getUTCDate())}`;
  throw new Error(`Invalid date: ${s}`);}
function normalizeTime(s){ if(!s) return "12:00"; let t=s.trim().toUpperCase(); const ampm=/(AM|PM)$/.exec(t);
  if(ampm){ t=t.replace(/\s*(AM|PM)\s*$/,""); const [hhRaw,mmRaw="00"]=t.split(":"); let hh=parseInt(hhRaw,10); const mm=parseInt(mmRaw,10)||0;
    if(ampm[1]==="PM"&&hh<12) hh+=12; if(ampm[1]==="AM"&&hh===12) hh=0; return `${pad2(hh)}:${pad2(mm)}`; }
  const m=/^(\d{1,2}):(\d{1,2})$/.exec(t); if(m) return `${pad2(+m[1])}:${pad2(+m[2])}`; throw new Error(`Invalid time: ${s}`);}
function keyFromSky(pos){ const sun=pos.sun??0, root=Math.round(sun/30)%12; const moon=pos.moon??0; const mode=((moon>sun)?"major":"minor");
  const MAJ=[0,2,4,5,7,9,11], MIN=[0,2,3,5,7,8,10]; return {root, scale: mode==="major"?MAJ:MIN, mode}; }
async function getSky(dateStr,timeStr,lat,lon){ const hasLoc=Number.isFinite(lat)&&Number.isFinite(lon);
  const build=(base)=>{ const u=new URL(base,window.location.origin);
    if(dateStr) u.searchParams.set("date",normalizeDate(dateStr)); if(timeStr) u.searchParams.set("time",normalizeTime(timeStr));
    if(hasLoc&&base==="/chart"){ u.searchParams.set("lat",lat); u.searchParams.set("lon",lon);} return u.toString(); };
  if(hasLoc){ try{ return await fetchJSON(build("/chart")); }catch{} } return fetchJSON(build("/positions")); }
function getCuspsFromResponse(j){ return (j&&Array.isArray(j.cusps)&&j.cusps.length===12) ? j.cusps.slice() : Array.from({length:12},(_,i)=>i*30); }
function mergePositions(a,b){ const out={...a}; for(const [n,d] of Object.entries(b||{})){ if(out[n]!==undefined) out[`${n}_b`]=d; else out[n]=d; } return out; }
function houseOfDeg(deg,cusps){ const d=((deg%360)+360)%360; for(let i=0;i<12;i++){ const a0=cusps[i],a1=cusps[(i+1)%12];
  if(a1>a0){ if(d>=a0&&d<a1) return i; } else { if(d>=a0||d<a1) return i; } } return 0; }
function groupPlanetsByHouse(positions,cusps){ const by=Array.from({length:12},()=>[]); for(const [n,deg] of Object.entries(positions)){ if(typeof deg!=="number") continue; by[houseOfDeg(deg,cusps)].push(n);} return by; }

// ---- "My Chart" persistence ----
const MY_CHART_KEY="astradio:natal";
function loadMyChart(){ try{return JSON.parse(localStorage.getItem(MY_CHART_KEY)||"null");}catch{return null;} }
function saveMyChart(v){ localStorage.setItem(MY_CHART_KEY, JSON.stringify(v)); }

// ------------ UI wiring ------------
const gSel=document.getElementById("genre");
const statusEl=document.getElementById("status");
const btnGen=document.getElementById("generate");
const btnStop=document.getElementById("stop");
const btnBack=document.getElementById("back"); // kept but unused now
const combinedWrap=document.getElementById("combinedWrap"); // small combined preview during playback
gSel.value=localStorage.getItem("genre")||"ambient";
gSel.addEventListener("change",()=> localStorage.setItem("genre", gSel.value));

// mini geocoder for A/B
function attachGeocoder(prefix){
  const place=document.getElementById(`${prefix}_place`);
  const latEl=document.getElementById(`${prefix}_lat`);
  const lonEl=document.getElementById(`${prefix}_lon`);
  const list=document.getElementById(`${prefix}_places`);
  const map=new Map(); let t;
  place.addEventListener("input",(e)=>{
    const val=e.target.value.trim(); const hit=map.get(val);
    if(hit){ latEl.value=String(hit.lat); lonEl.value=String(hit.lon); return; }
    clearTimeout(t); if(val.length<2){ list.innerHTML=""; return; }
    t=setTimeout(async()=>{ try{
      const items=await fetchJSON(`/geocode?q=${encodeURIComponent(val)}`); map.clear();
      list.innerHTML=items.map(it=>{ map.set(it.label,{lat:it.lat,lon:it.lon}); return `<option value="${it.label}"></option>`; }).join("");
    }catch{} },250);
  });
}
attachGeocoder("a"); attachGeocoder("b");

// local wheel preview renderer (keeps the two wheels always visible)
async function preview(prefix,wheelId){
  try{
    const date=document.getElementById(`${prefix}_date`).value;
    const time=document.getElementById(`${prefix}_time`).value;
    const lat =parseFloat(document.getElementById(`${prefix}_lat`).value);
    const lon =parseFloat(document.getElementById(`${prefix}_lon`).value);
    const data=await getSky(date,time,lat,lon);
    const cusps=getCuspsFromResponse(data);
    const svg=document.getElementById(wheelId);
    // draw
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    const circ=document.createElementNS("http://www.w3.org/2000/svg","circle");
    circ.setAttribute("cx","0");circ.setAttribute("cy","0");circ.setAttribute("r","200");
    circ.setAttribute("fill","none");circ.setAttribute("stroke","#2a3a5a");svg.appendChild(circ);
    const R_OUT=200,R_IN=120, pol=(r,e)=>({x:r*Math.cos((-e+180)*Math.PI/180),y:r*Math.sin((-e+180)*Math.PI/180)});
    const arc=(r1,r2,a0,a1)=>{const s=((a1-a0+360)%360)||360;const p0=pol(r1,a0),p1=pol(r1,a1),p2=pol(r2,a1),p3=pol(r2,a0);
      const large=s>180?1:0;return `M ${p0.x} ${p0.y} A ${r1} ${r1} 0 ${large} 0 ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${r2} ${r2} 0 ${large} 1 ${p3.x} ${p3.y} Z`;};
    for(let i=0;i<12;i++){const a0=cusps[i],a1=cusps[(i+1)%12];const s=(a1>a0)?(a1-a0):(a1+360-a0);
      const p=document.createElementNS("http://www.w3.org/2000/svg","path");p.setAttribute("d",arc(R_OUT,R_IN,a0,a0+s));
      p.setAttribute("fill","#111a2e");p.setAttribute("stroke","#203052");p.setAttribute("stroke-width","1");svg.appendChild(p);
      const mid=(a0+s/2)%360;const txt=document.createElementNS("http://www.w3.org/2000/svg","text");
      const m=pol((R_OUT+R_IN)/2,mid);txt.setAttribute("x",m.x);txt.setAttribute("y",m.y+3);
      txt.setAttribute("class","house-num");txt.setAttribute("text-anchor","middle");txt.textContent=String(i+1);svg.appendChild(txt);}
    for(const [,deg] of Object.entries(data.positions||{})){const p=pol(R_OUT-10,deg);
      const t=document.createElementNS("http://www.w3.org/2000/svg","text");t.setAttribute("x",p.x);t.setAttribute("y",p.y+4);
      t.setAttribute("text-anchor","middle");t.textContent="•";svg.appendChild(t);}
    statusEl.textContent=`Previewed ${prefix.toUpperCase()}.`;
    return { positions: data.positions||{}, cusps };
  }catch(e){ return { positions:{}, cusps:Array.from({length:12},(_,i)=>i*30) }; }
}

// ---- Playback (merged) keeps A & B wheels visible; shows a small combined wheel too
async function startOverlayPlayback(posCombined,cusps){
  const rules=await getRules(); const key=keyFromSky(posCombined);
  const master=new Tone.Volume(-6).toDestination();
  const limiter=new Tone.Limiter(-1).connect(master);
  const reverb=new Tone.Reverb({decay:3.0,wet:0.25}).connect(limiter);
  const synth=(osc,env)=> new Tone.Synth({oscillator:{type:osc}, envelope:env}).connect(reverb);
  const pad =synth("sine",{attack:.02,decay:.2,sustain:.6,release:.25});
  const lead=synth("triangle",{attack:.01,decay:.1,sustain:.4,release:.15});
  const bass=synth("square",{attack:.005,decay:.1,sustain:.5,release:.2});
  const byHouse=groupPlanetsByHouse(posCombined,cusps);
  const segSec=(rules.segmentSeconds||5); const totalSec=segSec*12;
  const A4=440, midiToFreq=(m)=>A4*Math.pow(2,(m-69)/12);
  const chooseRoot=(base,h)=> 60 + ([0,5,7,2,9,4,11,5,7,0,2,9][h%12] + base)%12;
  function chord(root,major){ const third=major?4:3; return [0,third,7].map(s=>midiToFreq(root+s)); }
  Tone.Transport.stop(); Tone.Transport.cancel(); Tone.Transport.bpm.value=100;

  // render the combined wheel (third view) but keep A & B visible
  combinedWrap.classList.remove("hidden");
  Wheel.setData(posCombined,cusps);   // uses #wheel inside combinedWrap
  Wheel.highlight(0);

  for(let h=0;h<12;h++){
    const start=h*segSec; const root=chooseRoot(key.root,h); const c=chord(root,key.mode==="major");
    Tone.Transport.schedule((t)=> pad.triggerAttackRelease(c, segSec, t, 0.5), start);
    for(let i=0;i<2;i++){ Tone.Transport.schedule((t)=> bass.triggerAttackRelease(midiToFreq(root-12),0.35,t,0.8), start+i*(segSec/2)); }
    const steps=Math.floor(segSec/0.125);
    for(let s=0;s<steps;s++){ const idx=s%c.length; Tone.Transport.schedule((t)=> lead.triggerAttackRelease(c[idx],0.09,t,0.35), start+s*0.125); }
    Tone.Transport.schedule(()=>{ Wheel.highlight(h); const names=byHouse[h].length?byHouse[h].join(", "):"neutral motif";
      statusEl.textContent=`House ${h+1} • ${names}`; }, start);
  }
  await Tone.start(); Tone.Transport.start("+0.1");
  Tone.Transport.scheduleOnce(()=>{ Tone.Transport.stop(); statusEl.textContent="Overlay sequence complete."; }, totalSec+0.1);
}

// ---- Buttons & default behavior ----
btnGen.addEventListener("click", async ()=>{
  try{
    statusEl.textContent="Generating...";
    const a = await getSky(
      document.getElementById("a_date").value,
      document.getElementById("a_time").value,
      parseFloat(document.getElementById("a_lat").value),
      parseFloat(document.getElementById("a_lon").value)
    );
    const b = await getSky(
      document.getElementById("b_date").value,
      document.getElementById("b_time").value,
      parseFloat(document.getElementById("b_lat").value),
      parseFloat(document.getElementById("b_lon").value)
    );
    const cusps=getCuspsFromResponse(a);            // sectoring from A
    const positions=mergePositions(a.positions||{}, b.positions||{});
    await startOverlayPlayback(positions,cusps);    // keep both wheels visible; show combined too
  }catch(e){ console.error(e); statusEl.textContent=`Error: ${e.message}`; }
});
btnStop.addEventListener("click",()=> Tone.Transport.stop());

// ---- Helpers to set/get inputs ----
function setInputs(prefix,obj){
  document.getElementById(`${prefix}_date`).value=obj.date||"";
  document.getElementById(`${prefix}_time`).value=obj.time||"";
  document.getElementById(`${prefix}_place`).value=obj.place||"";
  document.getElementById(`${prefix}_lat`).value=obj.lat??"";
  document.getElementById(`${prefix}_lon`).value=obj.lon??"";
}
function getInputs(prefix){
  return { date:document.getElementById(`${prefix}_date`).value.trim(),
    time:document.getElementById(`${prefix}_time`).value.trim(),
    place:document.getElementById(`${prefix}_place`).value.trim(),
    lat:parseFloat(document.getElementById(`${prefix}_lat`).value),
    lon:parseFloat(document.getElementById(`${prefix}_lon`).value) };
}

// Inject Save/Use buttons for My Chart under A (kept from prior build)
(function injectMyChartButtons(){
  const card=document.getElementById("a_place").closest(".card");
  const row=document.createElement("div"); row.style.display="flex"; row.style.gap="8px"; row.style.marginTop="8px";
  const btnSave=document.createElement("button"); btnSave.textContent="Save as My Chart";
  const btnUse=document.createElement("button");  btnUse.textContent="Use My Chart";
  row.appendChild(btnSave); row.appendChild(btnUse); card.appendChild(row);
  btnSave.addEventListener("click", ()=>{
    const vals=getInputs("a");
    if(!vals.date||!vals.time||!Number.isFinite(vals.lat)||!Number.isFinite(vals.lon)||!vals.place){
      alert("Fill Date, Time, and select a Place from the list, then Save as My Chart."); return;
    }
    saveMyChart(vals); statusEl.textContent="Saved as My Chart.";
  });
  btnUse.addEventListener("click", ()=>{ const mine=loadMyChart();
    if(!mine){ alert("No saved chart yet."); return; }
    setInputs("a",mine); preview("a","wheelA"); statusEl.textContent="Loaded My Chart into A."; });
})();

// ---- Default AUTO-FILL on load ----
window.addEventListener("load", async ()=>{
  // A = My Chart if present; otherwise leave blanks
  const mine=loadMyChart();
  if(mine){ setInputs("a",mine); await preview("a","wheelA"); }

  // B = Today (no lat/lon needed; positions endpoint)
  const now=new Date();
  setInputs("b",{ date:now.toISOString().slice(0,10), time:now.toTimeString().slice(0,5), place:"Today (Transits)" });
  await preview("b","wheelB");

  statusEl.textContent = mine ? "Loaded My Chart vs Today." : "Enter your birth data in A or use Save as My Chart. B is Today.";
});
