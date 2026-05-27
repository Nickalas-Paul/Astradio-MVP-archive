'use client';

import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../core/api-base';
import type { RelationalIntent } from '../lib/relational-intent';
import type { SynastryBulletLine } from '../core/compat/types';

export type ExtendedCompatBullet = {
  label: string;
  text: string;
  key: string;
};

export interface ProfileCompatibilityPanelProps {
  seekerChartId: string;
  targetChartId: string;
  intent: RelationalIntent;
  discoveryBullets?: {
    forThem?: SynastryBulletLine;
    forYou?: SynastryBulletLine;
    together?: SynastryBulletLine;
  };
}

function BulletRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg p-4 space-y-2">
      <p className="text-xs font-semibold text-subtext uppercase tracking-wide">{label}</p>
      <p className="text-body text-text">{text}</p>
    </div>
  );
}

function lineText(line: SynastryBulletLine | undefined): string {
  if (!line) return '';
  return line.text || '';
}

export function ProfileCompatibilityPanel({
  seekerChartId,
  targetChartId,
  intent,
  discoveryBullets,
}: ProfileCompatibilityPanelProps) {
  const [bullets, setBullets] = useState<ExtendedCompatBullet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiIntent = intent === 'lover' ? 'partner' : 'friend';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const qs = new URLSearchParams({
          seekerChartId,
          targetChartId,
          intent: apiIntent,
          count: '10',
        });
        const r = await fetch(`${getApiBaseUrl() || ''}/api/compat/extended?${qs}`, {
          credentials: 'same-origin',
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(
            typeof (data as { error?: string }).error === 'string'
              ? (data as { error: string }).error
              : 'Could not load compatibility'
          );
        }
        const list = Array.isArray((data as { bullets?: unknown }).bullets)
          ? ((data as { bullets: ExtendedCompatBullet[] }).bullets ?? [])
          : [];
        if (!cancelled) setBullets(list);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load compatibility');
          setBullets([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seekerChartId, targetChartId, apiIntent]);

  const hasDiscovery =
    discoveryBullets &&
    (lineText(discoveryBullets.forThem) ||
      lineText(discoveryBullets.forYou) ||
      lineText(discoveryBullets.together));

  const discoveryKeys = new Set(
    bullets.slice(0, 3).map((b) => b.key)
  );
  const additional = hasDiscovery
    ? bullets.filter((b) => !discoveryKeys.has(b.key))
    : bullets;

  return (
    <section className="rounded-xl border border-border bg-surface-1 p-5 space-y-5">
      <h2 className="text-lg font-semibold text-text">Why you&apos;re compatible</h2>

      {loading ? <p className="text-sm text-subtext">Loading synastry…</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      {!loading && !error ? (
        <>
          {hasDiscovery ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-text">Highlights</h3>
              {lineText(discoveryBullets?.forThem) ? (
                <BulletRow label="Why you're good for them" text={lineText(discoveryBullets?.forThem)} />
              ) : null}
              {lineText(discoveryBullets?.forYou) ? (
                <BulletRow label="Why they're good for you" text={lineText(discoveryBullets?.forYou)} />
              ) : null}
              {lineText(discoveryBullets?.together) ? (
                <BulletRow label="Why you're good together" text={lineText(discoveryBullets?.together)} />
              ) : null}
            </div>
          ) : null}

          {additional.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-text">More about this connection</h3>
              {additional.map((b) => (
                <BulletRow key={b.key} label={b.label} text={b.text} />
              ))}
            </div>
          ) : bullets.length > 0 && !hasDiscovery ? (
            <div className="space-y-3">
              {bullets.map((b) => (
                <BulletRow key={b.key} label={b.label} text={b.text} />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
