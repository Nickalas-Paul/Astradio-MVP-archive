// src/publicAdapter.ts
import { play as playEngine } from "./audio/Engine";

declare global {
  interface Window { Astradio?: any }
}

if (typeof window !== "undefined") {
  window.Astradio = window.Astradio || {};
  window.Astradio.play = (mode: string, genre: string, chart: any) => playEngine(mode, genre, chart);
  // eslint-disable-next-line no-console
  console.log("[AE] adapter ready");
}


