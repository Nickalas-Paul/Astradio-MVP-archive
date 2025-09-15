import * as Tone from 'tone';

export type NoteOpts = {
  velocity?: number;
  duration?: number;
  time?: number;
  [key: string]: unknown;
};

export class Scheduler {
  private transport: typeof Tone.Transport;
  private isInitialized = false;
  private lastScheduledTime = 0;
  private timeBuffer = 0.001; // 1ms buffer between events

  constructor() {
    this.transport = Tone.Transport;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    // Start Tone.js audio context
    await Tone.start();
    this.isInitialized = true;
    this.lastScheduledTime = 0;
  }

  private validateAndAdjustTime(time: number): number {
    // Ensure time is strictly greater than previous scheduled time
    if (time <= this.lastScheduledTime) {
      time = this.lastScheduledTime + this.timeBuffer;
    }
    this.lastScheduledTime = time;
    return time;
  }

  scheduleChord(player: any, notes: number[], time: number, duration: number, opts?: NoteOpts) {
    if (!this.isInitialized) {
      console.warn('Scheduler not initialized, scheduling will be queued');
      this.initialize().then(() => this.scheduleChord(player, notes, time, duration, opts));
      return;
    }

    const velocity = opts?.velocity || 0.8;
    const noteDuration = opts?.duration || duration;
    const adjustedTime = this.validateAndAdjustTime(time);

    // Schedule each note in the chord with slight time offsets to prevent conflicts
    notes.forEach((note, index) => {
      const noteTime = adjustedTime + (index * 0.001); // 1ms offset per note
      this.transport.schedule((time) => {
        if (player && player.triggerAttackRelease) {
          player.triggerAttackRelease(note, noteDuration, time, velocity);
        }
      }, noteTime);
    });
  }

  scheduleNote(player: any, note: number, time: number, duration: number, opts?: NoteOpts) {
    if (!this.isInitialized) {
      console.warn('Scheduler not initialized, scheduling will be queued');
      this.initialize().then(() => this.scheduleNote(player, note, time, duration, opts));
      return;
    }

    const velocity = opts?.velocity || 0.8;
    const noteDuration = opts?.duration || duration;
    const adjustedTime = this.validateAndAdjustTime(time);

    this.transport.schedule((time) => {
      if (player && player.triggerAttackRelease) {
        player.triggerAttackRelease(note, noteDuration, time, velocity);
      }
    }, adjustedTime);
  }

  schedulePattern(pattern: string, player: any, notes: number[], time: number, duration: number, opts?: NoteOpts) {
    if (!this.isInitialized) {
      console.warn('Scheduler not initialized, scheduling will be queued');
      this.initialize().then(() => this.schedulePattern(pattern, player, notes, time, duration, opts));
      return;
    }

    const velocity = opts?.velocity || 0.8;
    const stepDuration = duration / pattern.length;
    let currentTime = this.validateAndAdjustTime(time);

    pattern.split('').forEach((hit, index) => {
      if (hit === 'x' || hit === 'X') {
        const noteIndex = index % notes.length;
        const note = notes[noteIndex];
        const stepTime = currentTime + (index * stepDuration);
        
        this.scheduleNote(player, note, stepTime, stepDuration * 0.8, { velocity });
      }
    });
  }

  // Schedule a sequence of notes
  scheduleSequence(notes: Array<{note: number; time: number; duration: number; velocity?: number}>, player: any, startTime: number) {
    if (!this.isInitialized) {
      console.warn('Scheduler not initialized, scheduling will be queued');
      this.initialize().then(() => this.scheduleSequence(notes, player, startTime));
      return;
    }

    notes.forEach(({note, time, duration, velocity}) => {
      this.scheduleNote(player, note, startTime + time, duration, { velocity: velocity || 0.8 });
    });
  }

  start() {
    if (!this.isInitialized) {
      this.initialize().then(() => this.start());
      return;
    }
    this.transport.start();
  }

  stop() {
    this.transport.stop();
    this.lastScheduledTime = 0;
  }

  pause() {
    this.transport.pause();
  }

  getCurrentTime(): number {
    return this.transport.seconds;
  }

  clear() {
    this.transport.cancel();
    this.lastScheduledTime = 0;
  }

  resetTiming() {
    this.lastScheduledTime = 0;
  }

  setBPM(bpm: number) {
    this.transport.bpm.value = bpm;
  }

  getBPM(): number {
    return this.transport.bpm.value;
  }
}
