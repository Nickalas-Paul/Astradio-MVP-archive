'use client';

import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../core/api-base';
import type { RelationalIntent } from '../lib/relational-intent';
import type { SynastryBulletLine } from '../core/compat/types';
import { IdentityMarkdown } from '@/components/shared/IdentityMarkdown';
import { Card } from '@/components/shared/Card';

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
    <Card elevation="flat" padding="p-4" className="space-y-2">
      <p className="text-caption font-medium uppercase tracking-wide text-accent-light">{label}</p>
      <div className="text-body text-text-secondary leading-relaxed">
        <IdentityMarkdown content={text} />
      </div>
    </Card>
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

  const discoveryKeys = new Set(bullets.slice(0, 3).map((b) => b.key));
  const additional = hasDiscovery ? bullets.filter((b) => !discoveryKeys.has(b.key)) : bullets;

  return (
    <Card elevation="resting" padding="p-5" className="space-y-6">
      <h2 className="font-serif text-h3 font-semibold text-text-primary">Why you&apos;re compatible</h2>

      {loading ? <p className="text-body-sm text-text-secondary">Loading synastry…</p> : null}
      {error ? <p className="text-body-sm text-red-500">{error}</p> : null}

      {!loading && !error ? (
        <>
          {hasDiscovery ? (
            <div className="space-y-4">
              <h3 className="text-h4 font-semibold text-text-primary">Highlights</h3>
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
            <div className="space-y-4">
              <h3 className="text-h4 font-semibold text-text-primary">More about this connection</h3>
              {additional.map((b) => (
                <BulletRow key={b.key} label={b.label} text={b.text} />
              ))}
            </div>
          ) : bullets.length > 0 && !hasDiscovery ? (
            <div className="space-y-4">
              {bullets.map((b) => (
                <BulletRow key={b.key} label={b.label} text={b.text} />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
