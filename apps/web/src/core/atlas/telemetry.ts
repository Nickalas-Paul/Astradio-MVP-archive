// Atlas Telemetry - Non-blocking learning analytics
// Never blocks UI, always fails gracefully

export type AtlasEvent =
  | { t: 'atlas_view'; id?: string }
  | { t: 'atlas_search'; q: string; n: number }
  | { t: 'atlas_bookmark'; id: string; on: boolean }
  | { t: 'atlas_quiz'; id: string; correct: boolean }
  | { t: 'atlas_article_read'; id: string; progress: number }
  | { t: 'atlas_glossary_hover'; term: string };

type QueuedEvent = AtlasEvent & { ts: number; sessionId: string };

let queue: QueuedEvent[] = [];
let timer: number | null = null;
let sessionId: string;

if (typeof window !== 'undefined') {
  sessionId = localStorage.getItem('atlas_session_id') || 
    `atlas_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  localStorage.setItem('atlas_session_id', sessionId);
}

export function atlasTrack(event: AtlasEvent): void {
  if (typeof window === 'undefined') return;
  try {
    queue.push({ ...event, ts: Date.now(), sessionId });
    if (!timer) {
      timer = window.setTimeout(flush, 500 + Math.random() * 500);
    }
  } catch (error) {
    console.debug('[Atlas Telemetry] Failed to queue event:', error);
  }
}

async function flush(): Promise<void> {
  timer = null;
  if (queue.length === 0) return;
  try {
    const batch = queue.splice(0, 25);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    // Telemetry endpoint not implemented yet - skip for now
    console.debug('[Atlas Telemetry] Skipping batch send - endpoint not implemented');
    clearTimeout(timeoutId);
  } catch (error) {
    console.debug('[Atlas Telemetry] Failed to send batch:', error);
  }
  if (queue.length > 0) {
    timer = window.setTimeout(flush, 800 + Math.random() * 400);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (queue.length > 0) {
      try {
        const data = JSON.stringify({ source: 'atlas', events: queue, timestamp: Date.now() });
        // Telemetry endpoint not implemented yet - skip for now
        console.debug('[Atlas Telemetry] Skipping beacon send - endpoint not implemented');
      } catch (error) {
        console.debug('[Atlas Telemetry] Failed to send beacon:', error);
      }
    }
  });
}

export const atlasTrackers = {
  viewAtlas: () => atlasTrack({ t: 'atlas_view' }),
  viewArticle: (id: string) => atlasTrack({ t: 'atlas_view', id }),
  search: (query: string, resultCount: number) => atlasTrack({ t: 'atlas_search', q: query, n: resultCount }),
  bookmark: (id: string, isBookmarked: boolean) => atlasTrack({ t: 'atlas_bookmark', id, on: isBookmarked }),
  quizAnswer: (questionId: string, isCorrect: boolean) => atlasTrack({ t: 'atlas_quiz', id: questionId, correct: isCorrect }),
  articleProgress: (id: string, progress: number) => atlasTrack({ t: 'atlas_article_read', id, progress }),
  glossaryHover: (term: string) => atlasTrack({ t: 'atlas_glossary_hover', term })
};

