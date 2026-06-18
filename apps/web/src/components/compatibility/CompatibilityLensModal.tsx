'use client';

import { useState, useEffect } from 'react';
import { RELATIONSHIP_MODES, type RelationshipMode } from '../../core/compat/relationshipModes';
import {
  hasCompatibilityReadingSurface,
  type CompatibilityTextLike,
  type ExplanationLike,
} from '../../lib/compatibility-reading-surface';
import { IdentityMarkdown } from '@/components/shared/IdentityMarkdown';

const INTENT_TO_RELATIONSHIP: Record<string, RelationshipMode> = {
  friendship: 'friends',
  dating: 'lovers',
  collaboration: 'friends',
  mentor: 'friends',
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
    compatibilityText?: CompatibilityTextLike;
    explanation?: ExplanationLike | { sections?: Array<{ title?: string; text?: string; bullets?: string[] }> };
  } | null>(null);

  const chartAId = seekerChartId;

  useEffect(() => {
    if (!seekerChartId) {
      setError('Add your birth chart in My Sky first. Compatibility uses your stored chart only.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    const run = async () => {
      try {
        const relationshipMode = INTENT_TO_RELATIONSHIP[intent] || RELATIONSHIP_MODES[0];
        const r = await fetch('/api/comparisons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chartAId: chartAId!,
            chartBId: targetChartId,
            relationshipMode,
          }),
        });
        if (cancelled) return;
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d?.error || `Comparison failed ${r.status}`);
        }
        const json = await r.json();
        const seekerChartIdResp = (json as any).seekerChartId ?? chartAId;
        const targetChartIdResp = (json as any).targetChartId ?? targetChartId;
        if (seekerChartIdResp !== chartAId || targetChartIdResp !== targetChartId) {
          console.warn('[CompatibilityLensModal] comparison roles mismatch; using response roles', {
            requested: { chartAId, chartBId: targetChartId },
            response: { seekerChartId: seekerChartIdResp, targetChartId: targetChartIdResp },
          });
        }
        setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Comparison failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [seekerChartId, chartAId, targetChartId, intent]);

  const compatText = data?.compatibilityText;
  const short = typeof compatText === 'string' ? compatText : compatText?.short ?? '';
  const long = typeof compatText === 'object' ? compatText?.long ?? '' : '';
  const bullets = typeof compatText === 'object' && Array.isArray(compatText?.bullets) ? compatText.bullets : [];
  const sections = data?.explanation?.sections ?? [];
  const hasSurface = data
    ? hasCompatibilityReadingSurface(data.explanation ?? null, compatText)
    : false;
  const showStructuredSections = Array.isArray(sections) && sections.length > 0;
  const showCompatFallback =
    !showStructuredSections && (short || long || bullets.length > 0);
  const readingIncomplete = !loading && !!data && !error && !hasSurface;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface-0 border border-border rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto m-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Compatibility Lens: {targetDisplayName}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary p-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {loading && <p className="text-text-secondary text-sm">Loading comparison…</p>}
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {!loading && data && (
          <div className="space-y-4 text-sm">
            {readingIncomplete && (
              <p className="text-amber-600 dark:text-amber-300 border border-amber-500/30 rounded-lg px-3 py-2">
                Compatibility reading did not return text from the server. Try again, or contact support if this
                persists.
              </p>
            )}
            {showStructuredSections && (
              <div className="space-y-3">
                {sections.map((s, i) => (
                  <div key={i}>
                    {s.title ? (
                      <h2 className="reading-section-header mb-2 first:mt-0">{s.title}</h2>
                    ) : null}
                    {s.text ? <IdentityMarkdown content={s.text} /> : null}
                    {Array.isArray(s.bullets) && s.bullets.length > 0 ? (
                      <ul className="list-disc list-inside text-text-secondary space-y-1 mt-1">
                        {s.bullets.map((b, bi) => (
                          <li key={bi}>{b}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            {showCompatFallback && (
              <div className="space-y-4">
                {short ? (
                  <div>
                    <h2 className="reading-section-header mb-2 first:mt-0">Summary</h2>
                    <IdentityMarkdown content={short} />
                  </div>
                ) : null}
                {long ? (
                  <div>
                    <h2 className="reading-section-header mb-2 first:mt-0">Details</h2>
                    <IdentityMarkdown content={long} />
                  </div>
                ) : null}
                {bullets.length > 0 ? (
                  <ul className="list-disc list-inside text-text-secondary space-y-1">
                    {bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
