// Engine Adapter Layer - UI ↔ Engine Communication
// Provides abstraction between UI and engine endpoints with live/mock implementations

export type Stage = 'queued' | 'preparing' | 'generating' | 'mixing' | 'ready' | 'error';

export type CompositionRequest = {
  chartA: string;            // id
  chartB?: string;           // optional for overlay
  genre: 'classical' | 'jazz' | 'electronic' | 'house' | 'lofi' | 'ambient';
  durationSec: 60;
};

export type LayerMeta = { 
  key: 'melody' | 'harmony' | 'rhythm' | 'texture'; 
  gain: number;
  muted?: boolean;
  solo?: boolean;
};

export type JobUpdate =
  | { stage: Exclude<Stage, 'ready' | 'error'>; pct: number }
  | { stage: 'ready'; id: string; url: string; layers: LayerMeta[] }
  | { stage: 'error'; code: string; message: string };

export interface EngineAdapter {
  createComposition(req: CompositionRequest): Promise<{ jobId: string }>;
  subscribe(jobId: string, onUpdate: (u: JobUpdate) => void): () => void; // returns unsubscribe
  play(id: string): Promise<void>;
  stop(id: string): Promise<void>;
}

// Mock Adapter for parallel UI development
class MockEngineAdapter implements EngineAdapter {
  private subscriptions = new Map<string, (update: JobUpdate) => void>();
  private jobCounter = 0;

  async createComposition(req: CompositionRequest): Promise<{ jobId: string }> {
    const jobId = `mock-job-${++this.jobCounter}`;
    
    // Simulate async generation with staged updates
    setTimeout(() => this.simulateGeneration(jobId, req), 100);
    
    return { jobId };
  }

  private async simulateGeneration(jobId: string, req: CompositionRequest) {
    const stages: Array<{ stage: Stage; pct: number; delay: number }> = [
      { stage: 'queued', pct: 0, delay: 200 },
      { stage: 'preparing', pct: 10, delay: 500 },
      { stage: 'generating', pct: 30, delay: 800 },
      { stage: 'generating', pct: 60, delay: 600 },
      { stage: 'mixing', pct: 80, delay: 400 },
      { stage: 'mixing', pct: 95, delay: 300 },
    ];

    for (const { stage, pct, delay } of stages) {
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const update: JobUpdate = { stage, pct };
      this.notifySubscribers(jobId, update);
    }

    // Final success
    const mockLayers: LayerMeta[] = [
      { key: 'melody', gain: 0.8 },
      { key: 'harmony', gain: 0.7 },
      { key: 'rhythm', gain: 0.6 },
      { key: 'texture', gain: 0.5 },
    ];

    const finalUpdate: JobUpdate = {
      stage: 'ready',
      id: `mock-composition-${jobId}`,
      url: `/mock-audio/${jobId}.mp3`,
      layers: mockLayers,
    };

    this.notifySubscribers(jobId, finalUpdate);
  }

  subscribe(jobId: string, onUpdate: (update: JobUpdate) => void): () => void {
    this.subscriptions.set(jobId, onUpdate);
    
    return () => {
      this.subscriptions.delete(jobId);
    };
  }

  private notifySubscribers(jobId: string, update: JobUpdate) {
    const callback = this.subscriptions.get(jobId);
    if (callback) {
      callback(update);
    }
  }

  async play(id: string): Promise<void> {
    console.log(`[Mock] Playing composition ${id}`);
    // Mock play - no actual audio
  }

  async stop(id: string): Promise<void> {
    console.log(`[Mock] Stopping composition ${id}`);
    // Mock stop - no actual audio
  }
}

// Live Adapter for production engine integration
class LiveEngineAdapter implements EngineAdapter {
  private subscriptions = new Map<string, (update: JobUpdate) => void>();
  private eventSources = new Map<string, EventSource>();

  async createComposition(req: CompositionRequest): Promise<{ jobId: string }> {
    try {
      const response = await fetch('/api/vnext/compose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chartContext: {
            // This would be populated with actual chart data
            ts: new Date().toISOString(),
            tz: 'UTC',
            lat: -34.6037,
            lon: -58.3816,
            houseSystem: 'placidus',
            planets: [],
            houses: [],
            aspects: [],
            moonPhase: 0,
            dominantElements: { fire: 0, earth: 0, air: 0, water: 0 },
          },
          genre: req.genre,
          durationSec: req.durationSec,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        return { jobId: data.data.compositionId };
      } else {
        throw new Error(data.error || 'Composition creation failed');
      }
    } catch (error) {
      console.error('[Live Adapter] Composition creation failed:', error);
      throw error;
    }
  }

  subscribe(jobId: string, onUpdate: (update: JobUpdate) => void): () => void {
    // Store callback
    this.subscriptions.set(jobId, onUpdate);

    // Set up Server-Sent Events for real-time updates
    const eventSource = new EventSource(`/api/vnext/status/${jobId}`);
    this.eventSources.set(jobId, eventSource);

    eventSource.onmessage = (event) => {
      try {
        const update: JobUpdate = JSON.parse(event.data);
        onUpdate(update);
      } catch (error) {
        console.error('[Live Adapter] Failed to parse status update:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[Live Adapter] SSE error:', error);
      onUpdate({
        stage: 'error',
        code: 'CONNECTION_ERROR',
        message: 'Lost connection to composition status',
      });
    };

    return () => {
      this.subscriptions.delete(jobId);
      const eventSource = this.eventSources.get(jobId);
      if (eventSource) {
        eventSource.close();
        this.eventSources.delete(jobId);
      }
    };
  }

  async play(id: string): Promise<void> {
    try {
      const response = await fetch(`/api/vnext/play/${id}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Play failed: ${response.status}`);
      }
    } catch (error) {
      console.error('[Live Adapter] Play failed:', error);
      // Don't throw - UI should remain usable
    }
  }

  async stop(id: string): Promise<void> {
    try {
      const response = await fetch(`/api/vnext/stop/${id}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Stop failed: ${response.status}`);
      }
    } catch (error) {
      console.error('[Live Adapter] Stop failed:', error);
      // Don't throw - UI should remain usable
    }
  }
}

// Factory function with feature flag support
export const getEngineAdapter = (): EngineAdapter => {
  const useMock = !!(window as any).__USE_MOCK__;
  
  if (useMock) {
    console.log('[Engine Adapter] Using mock adapter for development');
    return new MockEngineAdapter();
  } else {
    console.log('[Engine Adapter] Using live adapter for production');
    return new LiveEngineAdapter();
  }
};

// Global adapter instance
export const engineAdapter = getEngineAdapter();

// Utility functions for UI components
export const createComposition = (req: CompositionRequest) => 
  engineAdapter.createComposition(req);

export const subscribeToJob = (jobId: string, onUpdate: (update: JobUpdate) => void) =>
  engineAdapter.subscribe(jobId, onUpdate);

export const playComposition = (id: string) =>
  engineAdapter.play(id);

export const stopComposition = (id: string) =>
  engineAdapter.stop(id);
