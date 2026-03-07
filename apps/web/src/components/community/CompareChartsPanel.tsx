'use client';

import { useState } from 'react';
import { LyriaAudio } from '../LyriaAudio';
import { LocationFinder } from '../sandbox/LocationFinder';

const RELATIONSHIP_MODES = [
  { value: 'friends', label: 'Friends' },
  { value: 'lovers', label: 'Lovers' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'collaborator', label: 'Collaborator' },
  { value: 'rivals', label: 'Rivals' },
  { value: 'neutral', label: 'Neutral' },
] as const;

type ChartInput = { label: string; date: string; time: string; lat: string; lon: string };

export interface CompareChartsPanelProps {
  onSwitchToGroups?: () => void;
}

const defaultChart = (): ChartInput => ({
  label: '',
  date: new Date().toISOString().split('T')[0],
  time: '12:00',
  lat: '40.7128',
  lon: '-74.006',
});

export function CompareChartsPanel({ onSwitchToGroups }: CompareChartsPanelProps = {}) {
  const [chartA, setChartA] = useState<ChartInput>(defaultChart());
  const [chartB, setChartB] = useState<ChartInput>(defaultChart());
  const [locationA, setLocationA] = useState('');
  const [locationB, setLocationB] = useState('');
  const [chartAId, setChartAId] = useState<string | null>(null);
  const [chartBId, setChartBId] = useState<string | null>(null);
  const [useInlineB, setUseInlineB] = useState(true);
  const [relationshipMode, setRelationshipMode] = useState<string>('friends');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    compatibilityText: { short?: string; long?: string; bullets?: string[] } | string;
    planHash?: string;
    compositionId?: string;
    audio?: { base64?: string };
  } | null>(null);

  const createChart = async (input: ChartInput) => {
    const r = await fetch('/api/charts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: input.label || 'Untitled',
        date: input.date,
        time: input.time,
        lat: parseFloat(input.lat) || 0,
        lon: parseFloat(input.lon) || 0,
      }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e?.error || `Charts API ${r.status}`);
    }
    return r.json();
  };

  const handleCreateChartA = async () => {
    setError(null);
    setLoading(true);
    try {
      const chart = await createChart(chartA);
      setChartAId(chart.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create chart A');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChartB = async () => {
    setError(null);
    setLoading(true);
    try {
      const chart = await createChart(chartB);
      setChartBId(chart.id);
      setUseInlineB(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create chart B');
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      let aId = chartAId;
      let bId: string | undefined;
      let chartBInline: { date: string; time: string; lat: number; lon: number } | undefined;
      if (!aId) {
        const created = await createChart(chartA);
        aId = created.id;
        setChartAId(aId);
      }
      if (useInlineB) {
        chartBInline = {
          date: chartB.date,
          time: chartB.time,
          lat: parseFloat(chartB.lat) || 0,
          lon: parseFloat(chartB.lon) || 0,
        };
      } else {
        bId = chartBId || undefined;
        if (!bId) {
          const created = await createChart(chartB);
          bId = created.id;
          setChartBId(bId ?? null);
        }
      }
      const r = await fetch('/api/comparisons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chartAId: aId,
          chartBId: bId,
          chartBInline: chartBInline,
          relationshipMode,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e?.error || `Comparisons API ${r.status}`);
      }
      const data = await r.json();
      setResult({
        compatibilityText: data.compatibilityText ?? '',
        planHash: data.planHash,
        compositionId: data.compositionId,
        audio: data.audio,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate comparison');
    } finally {
      setLoading(false);
    }
  };

  const compatText = result?.compatibilityText;
  const short = typeof compatText === 'string' ? compatText : compatText?.short ?? '';
  const long = typeof compatText === 'object' ? compatText?.long ?? '' : '';
  const bullets = typeof compatText === 'object' && Array.isArray(compatText?.bullets) ? compatText.bullets : [];
  const audioBase64 = result?.audio?.base64 ?? null;

  return (
    <div className="card space-y-6">
      <h2 className="text-xl font-semibold text-text">Compare Charts</h2>
      <p className="text-sm text-subtext">
        Create or select two natal charts and generate a compatibility summary and shared soundtrack.
      </p>

      <div className="rounded-lg border border-border bg-bgElev/60 p-3 space-y-2">
        <p className="text-sm text-text">
          <strong>Group or composite comparison (3+ charts):</strong> To compare more than two charts and get an aggregate compatibility view or shared group soundtrack, create a Group in the <strong>Groups</strong> tab and add member charts there. Astradio uses composite chart math for groups.
        </p>
        {onSwitchToGroups && (
          <button
            type="button"
            onClick={onSwitchToGroups}
            className="text-sm font-medium text-emerald hover:underline focus:outline focus:ring-2 focus:ring-emerald focus:ring-offset-2 rounded"
          >
            Go to Groups →
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-bgElev p-4">
          <h3 className="mb-3 text-sm font-medium text-text">Chart A</h3>
          <p className="text-xs text-subtext mb-2">Use location search and date/time. Coordinates are set from your place selection.</p>
          <div className="mb-2">
            <LocationFinder
              value={locationA}
              onSelect={(r) => {
                setLocationA(r.label);
                setChartA((c) => ({ ...c, lat: String(r.lat), lon: String(r.lon), label: c.label || r.label }));
              }}
              onClear={() => setLocationA('')}
              placeholder="City, region, or address"
            />
          </div>
          <input
            type="text"
            placeholder="Label"
            value={chartA.label}
            onChange={(e) => setChartA((c) => ({ ...c, label: e.target.value }))}
            className="input mb-2 w-full"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={chartA.date}
              onChange={(e) => setChartA((c) => ({ ...c, date: e.target.value }))}
              className="input flex-1"
            />
            <input
              type="time"
              value={chartA.time}
              onChange={(e) => setChartA((c) => ({ ...c, time: e.target.value }))}
              className="input w-24"
            />
          </div>
          <button
            type="button"
            onClick={handleCreateChartA}
            disabled={loading}
            className="mt-2 rounded-lg bg-bgElev px-3 py-1.5 text-sm text-subtext hover:bg-panel hover:text-text disabled:opacity-50"
          >
            Save as Chart A
          </button>
          {chartAId && <p className="mt-1 text-xs text-subtext">Id: {chartAId}</p>}
        </div>

        <div className="rounded-lg border border-border bg-bgElev p-4">
          <h3 className="mb-3 text-sm font-medium text-text">Chart B</h3>
          <label className="flex items-center gap-2 text-sm text-subtext">
            <input
              type="checkbox"
              checked={useInlineB}
              onChange={(e) => setUseInlineB(e.target.checked)}
            />
            Use inline (no save)
          </label>
          <p className="text-xs text-subtext mb-2 mt-1">Use location search and date/time. Coordinates are set from your place selection.</p>
          <div className="mb-2">
            <LocationFinder
              value={locationB}
              onSelect={(r) => {
                setLocationB(r.label);
                setChartB((c) => ({ ...c, lat: String(r.lat), lon: String(r.lon), label: c.label || r.label }));
              }}
              onClear={() => setLocationB('')}
              placeholder="City, region, or address"
            />
          </div>
          <input
            type="text"
            placeholder="Label"
            value={chartB.label}
            onChange={(e) => setChartB((c) => ({ ...c, label: e.target.value }))}
            className="input mb-2 w-full"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={chartB.date}
              onChange={(e) => setChartB((c) => ({ ...c, date: e.target.value }))}
              className="input flex-1"
            />
            <input
              type="time"
              value={chartB.time}
              onChange={(e) => setChartB((c) => ({ ...c, time: e.target.value }))}
              className="input w-24"
            />
          </div>
          {!useInlineB && (
            <button
              type="button"
              onClick={handleCreateChartB}
              disabled={loading}
              className="mt-2 rounded-lg bg-bgElev px-3 py-1.5 text-sm text-subtext hover:bg-panel hover:text-text disabled:opacity-50"
            >
              Save as Chart B
            </button>
          )}
          {chartBId && !useInlineB && <p className="mt-1 text-xs text-subtext">Id: {chartBId}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-subtext">Relationship:</span>
        <select
          value={relationshipMode}
          onChange={(e) => setRelationshipMode(e.target.value)}
          className="input w-40"
        >
          {RELATIONSHIP_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleCompare}
          disabled={loading || (!chartAId && !chartA.date)}
          className="rounded-lg bg-emerald px-4 py-2 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate compatibility'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3 rounded-lg border border-border bg-bgElev p-4">
          <h3 className="text-sm font-medium text-text">Compatibility</h3>
          {short && <p className="text-text">{short}</p>}
          {long && <p className="text-sm text-subtext">{long}</p>}
          {bullets.length > 0 && (
            <ul className="list-inside list-disc text-sm text-subtext">
              {bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
          {result.compositionId && (
            <p className="text-xs text-subtext">Composition: {result.compositionId.slice(0, 16)}…</p>
          )}
          {audioBase64 && (
            <div className="pt-2">
              <LyriaAudio base64={audioBase64} className="w-full max-w-md" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
