// Telemetry System - Lightweight client events for trending data
export type TelemetryEvent =
  | { t: 'play'; compId: string; ms: number }
  | { t: 'complete'; compId: string }
  | { t: 'like'; compId: string }
  | { t: 'share'; compId: string }
  | { t: 'generate'; genre: string; duration: number }
  | { t: 'error'; code: string; context: string }
  | { t: 'page_view'; route: string }
  | { t: 'feature_use'; feature: string; action: string };

function getTelemetryEndpoint(): string {
  if (typeof window === 'undefined') return '/api/telemetry';
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
  return base ? `${base}/api/telemetry` : '/api/telemetry';
}

class TelemetryManager {
  private queue: (TelemetryEvent & { timestamp: number })[] = [];
  private config = { enabled: true, endpoint: '/api/telemetry', batchSize: 25, flushInterval: 30000 };
  private flushTimer: number | null = null;
  private isFlushing = false;
  private readonly MAX_QUEUE = 200;

  constructor() {
    this.config.endpoint = getTelemetryEndpoint();
    this.startFlushTimer();
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => { void this.flush(true); });
    }
  }

  track(event: TelemetryEvent): void {
    if (!this.config.enabled) return;
    const enriched = { ...event, timestamp: Date.now() };
    if (this.queue.length >= this.MAX_QUEUE) this.queue.shift();
    this.queue.push(enriched);
    if (this.queue.length >= this.config.batchSize) this.scheduleFlush();
  }

  private startFlushTimer(): void {
    if (this.flushTimer && typeof window !== 'undefined') window.clearInterval(this.flushTimer);
    if (typeof window !== 'undefined') {
      this.flushTimer = window.setInterval(() => this.scheduleFlush(), this.config.flushInterval);
    }
  }

  private scheduleFlush(): void {
    if (this.isFlushing || this.queue.length === 0) return;
    const jitter = 300 + Math.random() * 500;
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => { void this.flush(); }, { timeout: jitter });
    } else {
      setTimeout(() => { void this.flush(); }, jitter);
    }
  }

  private async flush(force = false): Promise<void> {
    if (this.isFlushing || (!force && this.queue.length === 0)) return;
    this.isFlushing = true;
    const events = [...this.queue];
    this.queue = [];
    try {
      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events })
      });
    } catch {
      this.queue.unshift(...events);
    } finally {
      this.isFlushing = false;
    }
  }

  setEnabled(enabled: boolean): void { this.config.enabled = enabled; }
  setEndpoint(endpoint: string): void { this.config.endpoint = endpoint; }
  getQueueSize(): number { return this.queue.length; }
  clearQueue(): void { this.queue = []; }
}

const telemetry = new TelemetryManager();

export const track = (event: TelemetryEvent): void => telemetry.track(event);
export const trackPlay = (compId: string, ms: number) => track({ t: 'play', compId, ms });
export const trackComplete = (compId: string) => track({ t: 'complete', compId });
export const trackLike = (compId: string) => track({ t: 'like', compId });
export const trackShare = (compId: string) => track({ t: 'share', compId });
export const trackGenerate = (genre: string, duration: number) => track({ t: 'generate', genre, duration });
export const trackError = (code: string, context: string) => track({ t: 'error', code, context });
export const trackPageView = (route: string) => track({ t: 'page_view', route });
export const trackFeatureUse = (feature: string, action: string) => track({ t: 'feature_use', feature, action });
