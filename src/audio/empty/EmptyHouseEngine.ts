export type Genre = "Classical"|"Jazz"|"Electronic"|"House"|"Lo-Fi"|"Ambient";
export interface HouseContext {
  index: 1|2|3|4|5|6|7|8|9|10|11|12;
  empty: boolean;
  cuspSign: number; // 0..11
  ruler: string;
  startTime: number;
  duration: number;
  globalKey: { tonic: string; mode: string; };
  bpm: number; swing: number; intensity: number; seed: number;
}
export interface EngineDeps {
  pool: import("../instruments/InstrumentPool").InstrumentPool;
  bus: import("../mixer/MasterBus").MasterBus;
  sched: import("../playback/Scheduler").Scheduler;
}
export function renderEmptyHouse(_genre:Genre,_ctx:HouseContext,_d:EngineDeps) {
  // no-op stub; real behaviors plug in here
}
