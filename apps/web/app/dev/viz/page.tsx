'use client';

import { useEffect, useState } from 'react';
import { buildVizPayload } from '@/viz/payload';
import type { VizPayload } from '@/viz/types';
import { VizScene } from '@/viz/VizScene';

const FIXED_CHART = {
  date: '1990-01-01',
  time: '12:00',
  lat: 40.7128,
  lon: -74.006,
};

export default function DevVizPage() {
  const [payload, setPayload] = useState<VizPayload | null>(null);
  const [checksum, setChecksum] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        setLoading(true);

        const birth = {
          date: FIXED_CHART.date,
          time: FIXED_CHART.time,
          lat: FIXED_CHART.lat,
          lon: FIXED_CHART.lon,
        };

        const [snapshotRes, composeRes] = await Promise.all([
          fetch('/api/sandbox/snapshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ birth, overrides: {} }),
          }),
          fetch('/api/compose', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'sandbox',
              chartData: {
                date: FIXED_CHART.date,
                time: FIXED_CHART.time,
                lat: FIXED_CHART.lat,
                lon: FIXED_CHART.lon,
              },
              controls: {},
              includePlan: 1,
            }),
          }),
        ]);

        if (cancelled) return;

        if (!snapshotRes.ok) {
          const t = await snapshotRes.text();
          throw new Error(`Snapshot failed: ${snapshotRes.status} ${t}`);
        }
        if (!composeRes.ok) {
          const t = await composeRes.text();
          throw new Error(`Compose failed: ${composeRes.status} ${t}`);
        }

        const snapshotData = await snapshotRes.json();
        const composeData = await composeRes.json();

        const snapshot = snapshotData.snapshot ?? snapshotData;
        const plan = composeData.plan ?? {};
        const hashes = composeData.hashes ?? {};
        const audio = composeData.audio ?? {};
        const controls = composeData.controls ?? {};

        const seed = hashes.plan_sha256 ?? hashes.chartHash ?? composeData.artifacts?.payload_hash ?? 'dev-viz-seed';

        const { payload: vizPayload, checksum: cs } = await buildVizPayload(snapshot, plan, {
          provider_used: audio.provider_used ?? 'unknown',
          duration_s: audio.size_bytes ? undefined : 30,
          seed,
          controls,
        });

        if (cancelled) return;
        setPayload(vizPayload);
        setChecksum(cs);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200 p-8">
        <h1 className="text-xl font-semibold mb-4">Phase 3.5 — Viz Dev</h1>
        <p>Loading snapshot + compose…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200 p-8">
        <h1 className="text-xl font-semibold mb-4">Phase 3.5 — Viz Dev</h1>
        <p className="text-red-400">{error}</p>
        <p className="mt-2 text-sm text-zinc-500">Ensure engine is running and API_BASE_URL points to it.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 p-8">
      <h1 className="text-xl font-semibold mb-2">Phase 3.5 — Viz Dev</h1>
      <p className="text-sm text-zinc-500 mb-4">
        Fixed seed: {FIXED_CHART.date} {FIXED_CHART.time} @ {FIXED_CHART.lat},{FIXED_CHART.lon}
      </p>
      {checksum && (
        <p className="font-mono text-sm mb-4">
          Payload checksum: <span className="text-amber-400">{checksum.slice(0, 16)}…</span>
        </p>
      )}
      {payload && (
        <div className="space-y-4">
          <VizScene payload={payload} />
        </div>
      )}
    </div>
  );
}
