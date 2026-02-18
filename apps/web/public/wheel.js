// SVG wheel renderer (rotated 90° CCW; houses run counter-clockwise).
// Exposes Wheel.setData(positions, cusps) and Wheel.highlight(houseIdx).
(function(){
  const R_OUT = 200;     // outer radius
  const R_IN  = 120;     // inner radius of the ring

  // Convert ecliptic longitude to screen coords (ASC at 9 o'clock; CCW increases)
  function pol(r, eclDeg){
    const a = (-eclDeg + 180) * Math.PI / 180;   // CCW with 0 at left
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  }

  function clear(el){ while (el.firstChild) el.removeChild(el.firstChild); }

  // Ring sector path from house start a0 to a1 (deg)
  function arcPath(r1, r2, a0, a1){
    const span = ((a1 - a0 + 360) % 360) || 360;
    const p0 = pol(r1, a0), p1 = pol(r1, a1), p2 = pol(r2, a1), p3 = pol(r2, a0);
    const large = span > 180 ? 1 : 0;
    const sweepOuter = 0;  // CCW
    const sweepInner = 1;  // back
    return [
      `M ${p0.x} ${p0.y}`,
      `A ${r1} ${r1} 0 ${large} ${sweepOuter} ${p1.x} ${p1.y}`,
      `L ${p2.x} ${p2.y}`,
      `A ${r2} ${r2} 0 ${large} ${sweepInner} ${p3.x} ${p3.y}`,
      "Z"
    ].join(" ");
  }

  function labelText(el, str, eclDeg, rMid){
    const p = pol(rMid, eclDeg);
    const t = document.createElementNS("http://www.w3.org/2000/svg","text");
    t.setAttribute("x", p.x); t.setAttribute("y", p.y+3);
    t.setAttribute("class", "house-num");
    t.setAttribute("text-anchor", "middle");
    t.textContent = str;
    el.appendChild(t);
  }

  const PLANET_GLYPH = {
    sun:"\u2609", moon:"\u263D", mercury:"\u263F", venus:"\u2640",
    mars:"\u2642", jupiter:"\u2643", saturn:"\u2644", uranus:"\u2645",
    neptune:"\u2646", pluto:"\u2647"
  };

  function drawFrame(svg){
    const circ = document.createElementNS("http://www.w3.org/2000/svg","circle");
    circ.setAttribute("cx","0"); circ.setAttribute("cy","0");
    circ.setAttribute("r", String(R_OUT));
    circ.setAttribute("fill","none");
    circ.setAttribute("stroke","#2a3a5a");
    circ.setAttribute("stroke-width","1");
    svg.appendChild(circ);
  }

  function drawHouses(svg, cusps, activeIdx){
    for (let i=0;i<12;i++){
      const a0 = cusps[i];
      const a1 = cusps[(i+1)%12];
      const span = (a1 > a0) ? (a1 - a0) : (a1 + 360 - a0);

      const path = document.createElementNS("http://www.w3.org/2000/svg","path");
      path.setAttribute("d", arcPath(R_OUT, R_IN, a0, a0+span));
      const on = (i === activeIdx);
      path.setAttribute("fill", on ? "#1e2b48" : "#111a2e");
      path.setAttribute("stroke", on ? "#3ea0ff" : "#203052");
      path.setAttribute("stroke-width", on ? "2" : "1");
      path.setAttribute("opacity", on ? "1" : "0.95");
      svg.appendChild(path);

      // Label at sector midpoint
      const mid = (a0 + span/2) % 360;
      labelText(svg, String(i+1), mid, (R_OUT+R_IN)/2);
    }
  }

  function drawPlanets(svg, positions){
    for (const [name, deg] of Object.entries(positions)){
      if (typeof deg !== "number") continue;
      const p = pol(R_OUT - 10, deg);
      const t = document.createElementNS("http://www.w3.org/2000/svg","text");
      t.setAttribute("x", p.x); t.setAttribute("y", p.y+4);
      t.setAttribute("class", `planet ${name}`);
      t.setAttribute("text-anchor", "middle");
      t.textContent = PLANET_GLYPH[name] || "•";
      svg.appendChild(t);
    }
  }

  function render(svg, positions, cusps, activeIdx=0){
    clear(svg);
    drawFrame(svg);
    drawHouses(svg, cusps, activeIdx);
    drawPlanets(svg, positions);
  }

  // Public API used by engine.js
  window.Wheel = {
    render,
    highlight(activeIdx){
      const svg = document.getElementById("wheel");
      if (!this._positions || !this._cusps) return;
      render(svg, this._positions, this._cusps, activeIdx);
    },
    setData(positions, cusps){
      this._positions = positions;
      this._cusps = Array.isArray(cusps) && cusps.length===12
        ? cusps.slice()
        : Array.from({length:12},(_,i)=>i*30);
      const svg = document.getElementById("wheel");
      render(svg, this._positions, this._cusps, 0);
    }
  };
})();
