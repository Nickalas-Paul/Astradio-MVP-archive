// Atlas Telemetry - Non-blocking learning analytics
// Never blocks UI, always fails gracefully

export type AtlasEvent =
  | { t: 'atlas_view'; id?: string }
  | { t: 'atlas_search'; q: string; n: number }
  | { t: 'atlas_bookmark'; id: string; on: boolean }
  | { t: 'atlas_quiz'; id: string; correct: boolean }
  | { t: 'atlas_article_read'; id: string; progress: number }
  | { t: 'atlas_glossary_hover'; term: string };

interface QueuedEvent extends AtlasEvent {
  ts: number;
  sessionId: string;
}

let queue: QueuedEvent[] = [];
let timer: number | null = null;
let sessionId: string;

// Generate session ID once
if (typeof window !== 'undefined') {
  sessionId = localStorage.getItem('atlas_session_id') || 
    `atlas_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  localStorage.setItem('atlas_session_id', sessionId);
}

export function atlasTrack(event: AtlasEvent): void {
  if (typeof window === 'undefined') return;
  
  try {
    queue.push({
      ...event,
      ts: Date.now(),
      sessionId
    });
    
    // Schedule flush with jitter to avoid bursty sends
    if (!timer) {
      timer = window.setTimeout(flush, 500 + Math.random() * 500);
    }
  } catch (error) {
    // Silently fail - telemetry should never break the UI
    console.debug('[Atlas Telemetry] Failed to queue event:', error);
  }
}

async function flush(): Promise<void> {
  timer = null;
  
  if (queue.length === 0) return;
  
  try {
    const batch = queue.splice(0, 25); // Send max 25 events at once
    
    // Non-blocking fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    await fetch('/api/telemetry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'atlas',
        events: batch,
        timestamp: Date.now()
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
  } catch (error) {
    // Silently fail - telemetry should never break the UI
    console.debug('[Atlas Telemetry] Failed to send batch:', error);
  }
  
  // Schedule next flush if there are more events
  if (queue.length > 0) {
    timer = window.setTimeout(flush, 800 + Math.random() * 400);
  }
}

// Flush remaining events before page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (queue.length > 0) {
      // Use sendBeacon for reliable delivery on page unload
      try {
        const data = JSON.stringify({
          source: 'atlas',
          events: queue,
          timestamp: Date.now()
        });
        navigator.sendBeacon('/api/telemetry', data);
      } catch (error) {
        console.debug('[Atlas Telemetry] Failed to send beacon:', error);
      }
    }
  });
}

// Utility functions for common tracking patterns
export const atlasTrackers = {
  viewAtlas: () => atlasTrack({ t: 'atlas_view' }),
  viewArticle: (id: string) => atlasTrack({ t: 'atlas_view', id }),
  search: (query: string, resultCount: number) => atlasTrack({ t: 'atlas_search', q: query, n: resultCount }),
  bookmark: (id: string, isBookmarked: boolean) => atlasTrack({ t: 'atlas_bookmark', id, on: isBookmarked }),
  quizAnswer: (questionId: string, isCorrect: boolean) => atlasTrack({ t: 'atlas_quiz', id: questionId, correct: isCorrect }),
  articleProgress: (id: string, progress: number) => atlasTrack({ t: 'atlas_article_read', id, progress }),
  glossaryHover: (term: string) => atlasTrack({ t: 'atlas_glossary_hover', term })
};
