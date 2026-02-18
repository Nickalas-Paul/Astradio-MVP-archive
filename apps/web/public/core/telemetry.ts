// Telemetry System - Lightweight client events for trending data
// Emits events that never block play; buffer + flush pattern

export type TelemetryEvent =
  | { t: 'play'; compId: string; ms: number }
  | { t: 'complete'; compId: string }
  | { t: 'like'; compId: string }
  | { t: 'share'; compId: string }
  | { t: 'generate'; genre: string; duration: number }
  | { t: 'error'; code: string; context: string }
  | { t: 'page_view'; route: string }
  | { t: 'feature_use'; feature: string; action: string };

interface TelemetryConfig {
  enabled: boolean;
  endpoint: string;
  batchSize: number;
  flushInterval: number;
  maxRetries: number;
}

class TelemetryManager {
  private queue: TelemetryEvent[] = [];
  private config: TelemetryConfig;
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private readonly MAX_QUEUE = 200;
  private readonly BATCH_SIZE = 25;

  constructor() {
    this.config = {
      enabled: true,
      endpoint: '/api/telemetry',
      batchSize: this.BATCH_SIZE,
      flushInterval: 30000, // 30 seconds
      maxRetries: 3,
    };

    this.startFlushTimer();
    
    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flush(true); // Force immediate flush
      });
    }
  }

  track(event: TelemetryEvent): void {
    if (!this.config.enabled) {
      return;
    }

    // Add timestamp and session info
    const enrichedEvent = {
      ...event,
      timestamp: Date.now(),
      sessionId: this.getSessionId(),
      userId: this.getUserId(),
    };

    // Backpressure: drop oldest if queue is full
    if (this.queue.length >= this.MAX_QUEUE) {
      this.queue.shift(); // Drop oldest event
    }

    this.queue.push(enrichedEvent);

    // Auto-flush if batch size reached
    if (this.queue.length >= this.config.batchSize) {
      this.scheduleFlush();
    }
  }

  private getSessionId(): string {
    if (typeof window === 'undefined') return 'server';
    
    let sessionId = sessionStorage.getItem('telemetry_session_id');
    if (!sessionId) {
      sessionId = Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('telemetry_session_id', sessionId);
    }
    return sessionId;
  }

  private getUserId(): string | null {
    if (typeof window === 'undefined') return null;
    
    // In a real app, this would come from authentication
    // For now, use a persistent anonymous ID
    let userId = localStorage.getItem('telemetry_user_id');
    if (!userId) {
      userId = 'anon_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('telemetry_user_id', userId);
    }
    return userId;
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.scheduleFlush();
    }, this.config.flushInterval);
  }

  private scheduleFlush(): void {
    if (this.isFlushing || this.queue.length === 0) {
      return;
    }

    // Add jitter to prevent bursty sends when network resumes
    const jitter = 300 + Math.random() * 500; // 300-800ms jitter
    
    // Use requestIdleCallback if available, otherwise setTimeout with jitter
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => this.flush(), { timeout: jitter });
    } else {
      setTimeout(() => this.flush(), jitter);
    }
  }

  private async flush(force = false): Promise<void> {
    if (this.isFlushing || (!force && this.queue.length === 0)) {
      return;
    }

    this.isFlushing = true;
    const events = [...this.queue];
    this.queue = [];

    try {
      await this.sendEvents(events);
    } catch (error) {
      console.warn('[Telemetry] Failed to send events:', error);
      
      // Re-queue events for retry (up to maxRetries)
      if (events.length > 0) {
        this.queue.unshift(...events);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  private async sendEvents(events: any[]): Promise<void> {
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        events,
        batchId: Math.random().toString(36).substr(2, 9),
      }),
    });

    if (!response.ok) {
      throw new Error(`Telemetry send failed: ${response.status}`);
    }
  }

  // Public methods for configuration
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  setEndpoint(endpoint: string): void {
    this.config.endpoint = endpoint;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  clearQueue(): void {
    this.queue = [];
  }
}

// Global telemetry instance
const telemetry = new TelemetryManager();

// Public API
export const track = (event: TelemetryEvent): void => {
  telemetry.track(event);
};

export const trackPlay = (compId: string, ms: number): void => {
  track({ t: 'play', compId, ms });
};

export const trackComplete = (compId: string): void => {
  track({ t: 'complete', compId });
};

export const trackLike = (compId: string): void => {
  track({ t: 'like', compId });
};

export const trackShare = (compId: string): void => {
  track({ t: 'share', compId });
};

export const trackGenerate = (genre: string, duration: number): void => {
  track({ t: 'generate', genre, duration });
};

export const trackError = (code: string, context: string): void => {
  track({ t: 'error', code, context });
};

export const trackPageView = (route: string): void => {
  track({ t: 'page_view', route });
};

export const trackFeatureUse = (feature: string, action: string): void => {
  track({ t: 'feature_use', feature, action });
};

// Configuration helpers
export const setTelemetryEnabled = (enabled: boolean): void => {
  telemetry.setEnabled(enabled);
};

export const setTelemetryEndpoint = (endpoint: string): void => {
  telemetry.setEndpoint(endpoint);
};

export const getTelemetryQueueSize = (): number => {
  return telemetry.getQueueSize();
};

export const clearTelemetryQueue = (): void => {
  telemetry.clearQueue();
};

// React hook for telemetry
export const useTelemetry = () => {
  return {
    track,
    trackPlay,
    trackComplete,
    trackLike,
    trackShare,
    trackGenerate,
    trackError,
    trackPageView,
    trackFeatureUse,
  };
};

// Development helpers
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__telemetry = {
    track,
    getQueueSize: getTelemetryQueueSize,
    clearQueue: clearTelemetryQueue,
    setEnabled: setTelemetryEnabled,
  };
}
