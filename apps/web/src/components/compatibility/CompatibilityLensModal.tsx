'use client';

import { useState, useEffect } from 'react';

const INTENT_TO_RELATIONSHIP: Record<string, string> = {
  friendship: 'friends',
  dating: 'lovers',
  collaboration: 'friends',
  mentor: 'mentor',
  roommate: 'friends',
  study: 'friends',
};

interface CompatibilityLensModalProps {
  seekerChartId: string | null;
  targetChartId: string;
  targetDisplayName: string;
  onClose: () => void;
  intent?: string;
}

export function CompatibilityLensModal({
  seekerChartId,
  targetChartId,
  targetDisplayName,
  onClose,
  intent = 'friendship',
}: CompatibilityLensModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    compatibilityText?: { short?: string; long?: string; bullets?: string[] } | string;
    explanation?: { sections?: Array<{ title: string; text: string }> };
  } | null>(null);

  const chartAId = seekerChartId;

  useEffect(() => {
    if (!seekerChartId) {
      setError('Add your birth chart in Profile first. Compatibility uses your stored chart only.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    const run = async () => {
      try {
        const relationshipMode = INTENT_TO_RELATIONSHIP[intent] || 'friends';
        const r = await fetch('/api/comparisons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chartAId: chartAId!,
            chartBId: targetChartId,
            relationshipMode,
            generateComposition: false,
          }),
        });
        if (cancelled) return;
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d?.error || `Comparison failed ${r.status}`);
        }
        const json = await r.json();
        setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Comparison failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [seekerChartId, chartAId, targetChartId, intent]);

  const compatText = data?.compatibilityText;
  const short = typeof compatText === 'string' ? compatText : compatText?.short ?? '';
  const long = typeof compatText === 'object' ? compatText?.long ?? '' : '';
  const bullets = typeof compatText === 'object' && Array.isArray(compatText?.bullets) ? compatText.bullets : [];
  const sections = data?.explanation?.sections ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface-0 border border-border rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto m-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text">Compatibility Lens — {targetDisplayName}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-subtext hover:text-text p-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {loading && <p className="text-subtext text-sm">Loading comparison…</p>}
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {!loading && data && (
          <div className="space-y-4 text-sm">
            {short && (
              <div>
                <h3 className="font-medium text-text mb-1">Summary</h3>
                <p className="text-subtext">{short}</p>
              </div>
            )}
            {long && (
              <div>
                <h3 className="font-medium text-text mb-1">Details</h3>
                <p className="text-subtext">{long}</p>
              </div>
            )}
            {bullets.length > 0 && (
              <ul className="list-disc list-inside text-subtext space-y-1">
                {bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
            {sections.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-border">
                {sections.map((s, i) => (
                  <div key={i}>
                    <h3 className="font-medium text-text mb-1">{s.title}</h3>
                    <p className="text-subtext">{s.text}</p>
                  </div>
                ))}
              </div>
            )}
            {!short && !long && bullets.length === 0 && sections.length === 0 && (
              <p className="text-subtext">No narrative available for this comparison.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
