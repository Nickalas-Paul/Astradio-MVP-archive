import * as Tone from "tone";
import { AssetManager, type LoadedInstrument } from './loaders';

type Chart = { positions?: Record<string, any>; cusps?: any };
type Stop = { stopId: string; label: string; durationMs: number; ctx: any };
type Path = { stops: Stop[]; totalDuration: number };
type Motif = { notes: number[]; rhythm: number[] };
type SegmentContext = { ruler: string; aspects: any[]; element: 'fire'|'earth'|'air'|'water'; lunarPhase: string; mode: string; genre: string };

const ONE_MINUTE_MS = 60_000;
const DEFAULT_SCALE = [0,2,4,7,9];

// Planet contour biases from MelodyEngine
const PLANET_CONTOURS = {
  Sun: 'up-arc', Moon: 'oscillate', Mercury: 'quick-steps', Venus: 'smooth-stepwise',
  Mars: 'leaps', Jupiter: 'wide-leaps', Saturn: 'repeated-descending',
  Uranus: 'surprise-jumps', Neptune: 'unresolved', Pluto: 'sustain-rest'
};

// Aspect micro-motifs from MelodyEngine
const ASPECT_MOTIFS = {
  conjunction: 'unison', square: 'syncopated-jab', trine: 'arpeggio',
  opposition: 'call-response', sextile: 'grace-note'
};

// Element phrasing characteristics from MelodyEngine
const ELEMENT_PHRASING = {
  fire: { brightness: 1.2, risingTendency: 0.8, density: 0.7 },
  earth: { brightness: 0.8, risingTendency: 0.3, density: 0.6 },
  air: { brightness: 1.0, risingTendency: 0.5, density: 1.2 },
  water: { brightness: 0.9, risingTendency: 0.4, density: 0.8 }
};

function msToSec(ms: number) { return ms / 1000; }
function safeMod(n: number, m: number) { return m ? ((n % m) + m) % m : 0; }
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

export class Engine {
  private chart: Chart;
  private limiter: Tone.Limiter | null = null;
  private parts: any[] = [];
  private initialized = false;
  private assetManager: AssetManager;

  constructor(chart: Chart) {
    this.chart = chart ?? { positions: {}, cusps: null };
    this.assetManager = new AssetManager();
  }

  private async ensureContext() { if (Tone.getContext().state !== "running") await Tone.start(); }
  private async initIfNeeded() { if (this.initialized) return; await this.ensureContext(); this.limiter = new Tone.Limiter(-1).toDestination(); this.initialized = true; }
  private clearSchedule() { try { this.parts.forEach(p=>{ try{p.stop?.()}catch{} try{p.dispose?.()}catch{} }); } catch {} this.parts=[]; try{Tone.Transport.cancel(0);}catch{} }

  private getPositions() { return this.chart.positions || {}; }
  private getCusps(): number[] { return Array.isArray(this.chart.cusps) && this.chart.cusps.length===12 ? this.chart.cusps : Array.from({length:12},(_,i)=>i*30); }
  private elementOfSign(sign: string): 'fire'|'earth'|'air'|'water' { const e:any={Aries:'fire',Leo:'fire',Sagittarius:'fire',Taurus:'earth',Virgo:'earth',Capricorn:'earth',Gemini:'air',Libra:'air',Aquarius:'air',Cancer:'water',Scorpio:'water',Pisces:'water'}; return e[sign]||'fire'; }
  private signFromDeg(deg: number): string { const s=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']; return s[Math.floor(((deg%360)+360)%360/30)%12]; }
  private houseOfDeg(deg: number, cusps: number[]): number { const d=((deg%360)+360)%360; for(let i=0;i<12;i++){const a0=cusps[i],a1=cusps[(i+1)%12]; if(a1>a0){ if(d>=a0&&d<a1) return i; } else { if(d>=a0||d<a1) return i; }} return 0; }
  private analyzeClusters(pos: Record<string,number>) { const names=Object.keys(pos).filter(p=>typeof pos[p]==='number'); const v=new Set<string>(); const out:any[]=[]; for(let i=0;i<names.length;i++){const a=names[i]; if(v.has(a)) continue; const g=[a]; v.add(a); for(let j=i+1;j<names.length;j++){const b=names[j]; if(v.has(b)) continue; const d=Math.min(Math.abs(pos[a]-pos[b]), Math.abs(360-Math.abs(pos[a]-pos[b]))); if(d<=20){g.push(b); v.add(b);} } if(g.length) out.push({planets:g}); } return out; }
  private analyzeElements(pos: Record<string,number>) { const c:any={fire:0,earth:0,air:0,water:0}; let tot=0; for(const [k,v] of Object.entries(pos)){ if(typeof v!=="number") continue; tot++; const sign=this.signFromDeg(v); c[this.elementOfSign(sign)]++; } const norm:any={}; for(const [k,v] of Object.entries(c)) norm[k]=tot? (v as number)/tot:0; return norm as {fire:number;earth:number;air:number;water:number}; }
  private analyzeLunar(pos: Record<string,number>) { const sun=pos.sun??pos.Sun??0; const moon=pos.moon??pos.Moon??0; let a=moon-sun; if(a<0) a+=360; const phase=a<=10||a>=350?'new': a>=170&&a<=190?'full': a<180?'waxing':'waning'; const sign=this.signFromDeg(moon); const disp:any={Aries:'mars',Taurus:'venus',Gemini:'mercury',Cancer:'moon',Leo:'sun',Virgo:'mercury',Libra:'venus',Scorpio:'pluto',Sagittarius:'jupiter',Capricorn:'saturn',Aquarius:'uranus',Pisces:'neptune'}; return { phase, sign: sign.toLowerCase(), dispositor: disp[sign]||'moon' }; }
  private findTightestAspect(pos: Record<string,number>) { const n=Object.keys(pos); let best:any=null,orb=999; for(let i=0;i<n.length;i++) for(let j=i+1;j<n.length;j++){const a=n[i],b=n[j]; if(typeof pos[a]!=="number"||typeof pos[b]!=="number") continue; const d=Math.min(Math.abs(pos[a]-pos[b]), Math.abs(360-Math.abs(pos[a]-pos[b]))); if(d<orb){orb=d; best={a,b,angle:d};}} return best; }
  private analyze(){ const positions=this.getPositions(); const cusps=this.getCusps(); return { clusters:this.analyzeClusters(positions), elements:this.analyzeElements(positions), lunar:this.analyzeLunar(positions), tightest:this.findTightestAspect(positions), positions, cusps }; }

  private buildPath(mode: string, genre: string, a:any): Path { const m=(mode||'house').toLowerCase(); const stops:Stop[]=[]; if(m==='cluster'||m==='clusters'){const tot=a.clusters.reduce((s:number,c:any)=>s+(c.planets?.length||0),0)||1; a.clusters.forEach((c:any,i:number)=>{const dur=Math.max(2000, Math.round(ONE_MINUTE_MS*((c.planets?.length||1)/tot))); stops.push({stopId:`CL${i+1}`,label:`CL${i+1}`,durationMs:dur,ctx:{mode:'cluster',genre,planets:c.planets}});});} else if(m==='elemental'){const w=a.elements; Object.entries(w).filter(([,v])=>(v as number)>0.1).forEach(([el,v])=>{const dur=Math.max(8000, Math.round(ONE_MINUTE_MS*(v as number))); stops.push({stopId:String(el),label:String(el).toUpperCase(),durationMs:dur,ctx:{mode:'elemental',genre,element:el}});});} else if(m==='lunar'){for(let i=1;i<=8;i++) stops.push({stopId:`PH${i}`,label:`PH${i}`,durationMs:7500,ctx:{mode:'lunar',genre,lunar:a.lunar}});} else {for(let i=1;i<=12;i++) stops.push({stopId:`H${i}`,label:`H${i}`,durationMs:5000,ctx:{mode:'house',genre,house:i}});} let total=stops.reduce((s,x)=>s+(x.durationMs||0),0); if(!total){for(let i=1;i<=12;i++) stops.push({stopId:`H${i}`,label:`H${i}`,durationMs:Math.floor(ONE_MINUTE_MS/12),ctx:{mode:'house',genre}}); total=ONE_MINUTE_MS;} const tol=2000; if(Math.abs(total-ONE_MINUTE_MS)>tol){const k=ONE_MINUTE_MS/total; stops.forEach(s=> s.durationMs=Math.max(1000,Math.round(s.durationMs*k))); total=ONE_MINUTE_MS;} return { stops, totalDuration: total }; }

  private scaleForGenre(genre:string){const g=(genre||'').toLowerCase(); if(g==='classical') return [0,2,4,5,7,9,11]; if(g==='jazz') return [0,2,3,5,7,9,10]; if(g==='electronic'||g==='house') return [0,2,5,7,9]; if(g==='lofi'||g==='lo-fi') return [0,2,3,7,9]; return DEFAULT_SCALE; }
  private bpmForMode(mode:string){const m=(mode||'').toLowerCase(); return m==='clusters'?98 : m==='elemental'?84 : m==='lunar'?76 : 92; }
  private seedFromChart(a:any){ const p=a.positions||{}; const keys=Object.keys(p).sort(); let h=0; keys.forEach(k=>{const v=Math.floor((p[k]??0)*1000); h=((h<<5)-h+v)|0;}); return Math.abs(h)%12; }

  // Integrated MelodyEngine functions
  private seedMotif(sun: any, moon: any, tightestAspect: any): Motif {
    const sunNote = Math.floor((sun?.lon || 0) / 30) + 60;
    const moonNote = Math.floor((moon?.lon || 0) / 30) + 60;
    const baseNotes = [sunNote, moonNote];
    
    if (tightestAspect) {
      const aspectNote = Math.floor((tightestAspect.angle || 0) / 30) + 60;
      baseNotes.push(aspectNote);
    }
    
    const fourthNote = (baseNotes[0] + baseNotes[1]) % 12 + 60;
    baseNotes.push(fourthNote);
    
    const rhythm = [1, 1, 0.5, 1.5];
    return { notes: baseNotes, rhythm };
  }

  private transformMotif(motif: Motif, ctx: SegmentContext): Motif {
    let transformedNotes = [...motif.notes];
    let transformedRhythm = [...motif.rhythm];
    
    // Apply planet contour bias
    const contour = PLANET_CONTOURS[ctx.ruler as keyof typeof PLANET_CONTOURS] || 'up-arc';
    switch (contour) {
      case 'up-arc': transformedNotes = transformedNotes.map((note, i) => note + Math.floor(i * 0.5)); break;
      case 'oscillate': transformedNotes = transformedNotes.map((note, i) => note + (i % 2 === 0 ? 2 : -2)); break;
      case 'quick-steps': transformedRhythm = transformedRhythm.map(r => r * 0.5); break;
      case 'leaps': transformedNotes = transformedNotes.map((note, i) => note + (i * 3)); break;
      case 'wide-leaps': transformedNotes = transformedNotes.map((note, i) => note + (i * 5)); break;
      case 'repeated-descending': transformedNotes = transformedNotes.map((note, i) => note - (i * 2)); break;
      case 'surprise-jumps': transformedNotes = transformedNotes.map((note, i) => note + (Math.random() > 0.5 ? 7 : -7)); break;
      case 'unresolved': transformedNotes = transformedNotes.map((note, i) => note + (i % 2 === 0 ? 1 : -1)); break;
      case 'sustain-rest': transformedRhythm = transformedRhythm.map(r => r * 2); break;
    }
    
    // Apply element phrasing
    const elementPhrasing = ELEMENT_PHRASING[ctx.element];
    if (elementPhrasing) {
      const brightnessOffset = Math.floor((elementPhrasing.brightness - 1) * 3);
      transformedNotes = transformedNotes.map(note => note + brightnessOffset);
      const densityFactor = elementPhrasing.density;
      transformedRhythm = transformedRhythm.map(r => r / densityFactor);
    }
    
    // Apply lunar phase effects
    switch (ctx.lunarPhase) {
      case 'waxing': transformedRhythm = transformedRhythm.map(r => r * 1.2); break;
      case 'waning': transformedRhythm = transformedRhythm.map(r => r * 0.8); break;
      case 'full': transformedNotes = transformedNotes.map(note => note + 1); break;
      case 'new': transformedNotes = transformedNotes.map(note => note - 1); break;
    }
    
    // Ensure notes are within reasonable range (48-84 MIDI)
    transformedNotes = transformedNotes.map(note => Math.max(48, Math.min(84, note)));
    
    return { notes: transformedNotes, rhythm: transformedRhythm };
  }

  private async makeInstruments(genre: string) {
    const bus = new Tone.Gain(0.9).connect(this.limiter!);
    
    // Load manifest if not already loaded
    try {
      await this.assetManager.loadManifest('/audio/assets.manifest.json');
    } catch (error) {
      console.warn('[AE] Could not load manifest, using fallback instruments');
    }
    
    // Try to load real instruments based on genre
    let kick, snare, hats, bass, poly, lead;
    
    try {
      // Load drum kit based on genre
      const drumKitId = this.getDrumKitForGenre(genre);
      const drumKit = await this.assetManager.loadInstrument(drumKitId);
      
      if (drumKit?.sampler) {
        kick = drumKit.sampler;
        snare = drumKit.sampler;
        hats = drumKit.sampler;
      } else {
        throw new Error('Drum kit not available');
      }
    } catch (error) {
      // Fallback to synthesized drums
      kick = new Tone.MembraneSynth({octaves:6, pitchDecay:0.05}).connect(bus);
      snare = new Tone.NoiseSynth({noise:{type:'white'}, envelope:{attack:0.001,decay:0.2,sustain:0.1,release:0.8}}).connect(bus);
      hats = new Tone.MetalSynth({envelope:{attack:0.001,decay:0.15,release:0.02}, harmonicity:8,modulationIndex:40}).connect(bus);
    }
    
    try {
      // Load bass instrument
      const bassId = this.getBassForGenre(genre);
      const bassInstrument = await this.assetManager.loadInstrument(bassId);
      
      if (bassInstrument?.sampler) {
        bass = bassInstrument.sampler;
      } else {
        throw new Error('Bass instrument not available');
      }
    } catch (error) {
      // Fallback to synthesized bass
      bass = new Tone.MonoSynth({oscillator:{type:'sawtooth'}, envelope:{attack:0.02,decay:0.3,sustain:0.4,release:0.8}}).connect(bus);
    }
    
    try {
      // Load polyphonic instrument
      const polyId = this.getPolyForGenre(genre);
      const polyInstrument = await this.assetManager.loadInstrument(polyId);
      
      if (polyInstrument?.sampler) {
        poly = polyInstrument.sampler;
      } else {
        throw new Error('Poly instrument not available');
      }
    } catch (error) {
      // Fallback to synthesized poly
      poly = new Tone.PolySynth(Tone.Synth, {oscillator:{type:'triangle'}, envelope:{attack:0.1,decay:0.4,sustain:0.6,release:1.2}}).connect(new Tone.Reverb({decay:5,wet:0.3}).connect(bus));
    }
    
    try {
      // Load lead instrument
      const leadId = this.getLeadForGenre(genre);
      const leadInstrument = await this.assetManager.loadInstrument(leadId);
      
      if (leadInstrument?.sampler) {
        lead = leadInstrument.sampler;
      } else {
        throw new Error('Lead instrument not available');
      }
    } catch (error) {
      // Fallback to synthesized lead
      lead = new Tone.Synth({oscillator:{type:'triangle'}, envelope:{attack:0.01,release:0.2}}).connect(bus);
    }
    
    return { kick, snare, hats, bass, poly, lead };
  }
  
  private getDrumKitForGenre(genre: string): string {
    const g = genre.toLowerCase();
    if (g === 'jazz') return 'jazz_kit';
    if (g === 'house' || g === 'electronic') return 'tr909';
    if (g === 'lofi' || g === 'lo-fi') return 'jazz_kit';
    if (g === 'classical') return 'orch_perc';
    return 'tr808';
  }
  
  private getBassForGenre(genre: string): string {
    const g = genre.toLowerCase();
    if (g === 'jazz') return 'jazz_bass';
    if (g === 'classical') return 'upright_bass';
    if (g === 'lofi' || g === 'lo-fi') return 'upright_bass';
    if (g === 'ambient') return 'upright_bass';
    return 'upright_bass';
  }
  
  private getPolyForGenre(genre: string): string {
    const g = genre.toLowerCase();
    if (g === 'jazz') return 'rhodes';
    if (g === 'classical') return 'strings_ensemble';
    if (g === 'lofi' || g === 'lo-fi') return 'rhodes';
    if (g === 'ambient') return 'pad_choir';
    if (g === 'electronic' || g === 'house') return 'organ';
    return 'grand_piano';
  }
  
  private getLeadForGenre(genre: string): string {
    const g = genre.toLowerCase();
    if (g === 'jazz') return 'saxophone';
    if (g === 'classical') return 'flute';
    if (g === 'ambient') return 'flute';
    if (g === 'electronic' || g === 'house') return 'trumpet';
    return 'clarinet';
  }

  private renderStop(stop:Stop, analysis:any, mode:string, genre:string, scale:number[], rootMidi=60, instr:any){ 
    const parts:any[]=[]; 
    const durSec=msToSec(stop.durationMs); 
    
    // Rhythm section
    const kickSteps=[0,(genre==='house'||genre==='electronic')?0.5:null,1,2,3].filter(v=>v!==null) as number[]; 
    const kickPart=new Tone.Part((time:any)=>instr.kick.triggerAttackRelease('C1',0.1,time), kickSteps.map(s=>({time:s+'n'}))); 
    kickPart.loop=true; kickPart.loopEnd='1m'; parts.push(kickPart); 
    
    const snarePart=new Tone.Part((time:any)=>instr.snare.triggerAttackRelease('16n',time), ['2n','4n']); 
    snarePart.loop=true; snarePart.loopEnd='1m'; parts.push(snarePart); 
    
    const hatTimes:any[]=[]; for(let i=0;i<8;i++) hatTimes.push((i*0.5)+'n'); 
    const hatPart=new Tone.Part((time:any)=>instr.hats.triggerAttackRelease(0.02,time), hatTimes); 
    hatPart.loop=true; hatPart.loopEnd='1m'; parts.push(hatPart); 
    
    // Harmony section
    const seed=this.seedFromChart(analysis); 
    const root=clamp(rootMidi+(seed-6),36,72); 
    const getScale=(ix:number,oct:number)=> (scale.length? scale[safeMod(ix,scale.length)]:DEFAULT_SCALE[0])+12*oct; 
    const toName=(m:number)=>{const n=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']; return n[m%12]+(Math.floor(m/12)-1);}; 
    const triad=(deg:number,oct=5)=>{const a=clamp(root+getScale(deg,oct-4),24,96), b=clamp(root+getScale(deg+2,oct-4),24,96), c=clamp(root+getScale(deg+4,oct-4),24,96); return [toName(a),toName(b),toName(c)];}; 
    
    const padProg=[0,3,4,2]; 
    const padPart=new Tone.Part((time:any,ev:any)=>{const chord=triad(ev.deg,5); instr.poly.triggerAttackRelease(chord,'2n',time);}, padProg.map((d,i)=>({time:(i*0.5)+'m',deg:d}))); 
    padPart.loop=true; padPart.loopEnd='1m'; parts.push(padPart); 
    
    // Bass section
    const bassSeq=[0,2,4,0].map(ix=> clamp(root+(scale[safeMod(ix,scale.length)]||0)-24,24,72)); 
    const bassPart=new Tone.Sequence((time:any,step:number)=> instr.bass.triggerAttackRelease(toName(step),'8n',time), bassSeq,'4n'); 
    parts.push(bassPart); 
    
    // Enhanced melody section using MelodyEngine logic
    const positions = this.getPositions();
    const sun = positions.sun || positions.Sun;
    const moon = positions.moon || positions.Moon;
    const tightestAspect = analysis.tightest;
    
    // Create sophisticated motif using MelodyEngine
    const baseMotif = this.seedMotif(sun, moon, tightestAspect);
    
    // Build context for transformation
    const ctx: SegmentContext = {
      ruler: analysis.lunar?.dispositor || 'moon',
      aspects: tightestAspect ? [tightestAspect] : [],
      element: stop.ctx?.element || this.elementOfSign(this.signFromDeg(sun?.lon || 0)),
      lunarPhase: analysis.lunar?.phase || 'waxing',
      mode,
      genre
    };
    
    // Transform motif based on astrological context
    const transformedMotif = this.transformMotif(baseMotif, ctx);
    
    // Convert transformed motif to melody events
    const phraseBeats = durSec * 2; // Assuming 120 BPM = 2 beats per second
    const totalRhythm = transformedMotif.rhythm.reduce((a, b) => a + b, 0);
    
    for (let i = 0; i < transformedMotif.notes.length; i++) {
      const note = transformedMotif.notes[i];
      const rhythm = transformedMotif.rhythm[i] || 1;
      const duration = (rhythm / totalRhythm) * phraseBeats;
      const time = (i / transformedMotif.notes.length) * durSec;
      
      const leadPart = new Tone.Part((time: any) => {
        instr.lead.triggerAttackRelease(toName(note), duration + 'n', time);
      }, [{ time: time + 'n' }]);
      
      parts.push(leadPart);
    }
    
    return parts; 
  }

  private async schedule(path:Path, analysis:any, mode:string, genre:string){ 
    Tone.Transport.bpm.value=this.bpmForMode(mode); 
    const scale=this.scaleForGenre(genre); 
    const instr=await this.makeInstruments(genre); 
    let t=0; 
    for(const stop of path.stops){ 
      const startSec=msToSec(t); 
      const durSec=msToSec(stop.durationMs); 
      let parts:any[]=[]; 
      try{ 
        parts=this.renderStop(stop,analysis,mode,genre,scale,60,instr)||[]; 
      }catch(e){ 
        console.warn('[AE] stop render fail', stop.stopId, e); 
      } 
      if(!parts.length){ 
        const kick=new Tone.Part((time:any)=>instr.kick.triggerAttackRelease('C1','8n',time), [0,1,2,3].map(n=>startSec+n*(durSec/4))); 
        kick.start(startSec).stop(startSec+durSec); 
        this.parts.push(kick);
      } else { 
        parts.forEach(p=>{ 
          try{p.start?.(startSec)}catch{} 
          try{p.stop?.(startSec+durSec)}catch{} 
          this.parts.push(p); 
        }); 
      } 
      t+=stop.durationMs; 
    } 
  }

  public async play(mode:string, genre:string){ 
    await this.initIfNeeded(); 
    this.clearSchedule(); 
    try{ 
      const analysis=this.analyze(); 
      const path=this.buildPath(mode,genre,analysis); 
      await this.schedule(path,analysis,mode,genre); 
      if(Tone.Transport.state!=='started') Tone.Transport.start('+0.02'); 
      console.log('[AE] narrative path',{mode,genre,stops:path.stops.length,totalMs:path.totalDuration}); 
    } catch(e){ 
      console.error('[AE] play() failed; fallback',e); 
      const kick=new Tone.MembraneSynth({pitchDecay:0.01,octaves:4}).connect(this.limiter!); 
      const part=new Tone.Part((time:any)=>kick.triggerAttackRelease('C1','8n',time), ['0n','1n','2n','3n']); 
      part.loop=true; 
      part.loopEnd='1m'; 
      part.start(0).stop(60); 
      this.parts.push(part); 
      if(Tone.Transport.state!=='started') Tone.Transport.start('+0.02'); 
    } 
  }
}

export async function play(mode:string, genre:string, chart:Chart){ const eng=new Engine(chart); await eng.play(mode,genre); return eng; }


