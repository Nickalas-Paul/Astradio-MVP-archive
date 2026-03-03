'use client';

import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import { BirthDataForm } from '../../src/components/sandbox/BirthDataForm';
import { WheelCanvasBuilder } from '../../src/components/sandbox/WheelCanvasBuilder';
import { DegreePanel } from '../../src/components/sandbox/DegreePanel';
import type { SandboxDraft, SandboxBirth, SandboxOverrides, PlanetKey, EphemerisSnapshot, SandboxReport } from '../../src/types/sandbox';
import { getApiBaseUrl } from '../../src/core/api-base';

const PLANET_ORDER: PlanetKey[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

type SandboxState =
  | 'idle'
  | 'loading_base'
  | 'ready_builder'
  | 'syncing_overrides'
  | 'ready_report'
  | 'generating'
  | 'error';

function roundDegree(lonDeg: number): number {
  return Math.round(lonDeg * 10) / 10;
}

function normalizeOverrides(overrides: SandboxOverrides): SandboxOverrides {
  const sortedPlanets: Partial<Record<PlanetKey, { lonDeg: number }>> = {};
  const planetKeys = Object.keys(overrides.planets || {}) as PlanetKey[];
  planetKeys.sort((a, b) => a.localeCompare(b));
  for (const key of planetKeys) {
    const override = overrides.planets[key];
    if (override) sortedPlanets[key] = { lonDeg: roundDegree(override.lonDeg) };
  }
  return { planets: sortedPlanets, angles: overrides.angles };
}

const SANDBOX_CONTROLS = {
  arc_shape: 0.5,
  density_level: 0.6,
  tempo_norm: 0.7,
  step_bias: 0.7,
  leap_cap: 5,
  rhythm_template_id: 3,
  syncopation_bias: 0.3,
  motif_rate: 0.6,
};

function ExplainerSections({ explanation }: { explanation: any }) {
  if (!explanation?.sections) return null;
  const sections = Array.isArray(explanation.sections) ? explanation.sections : [];
  return (
    <div className="space-y-6">
      {sections.map((sec: any, i: number) => (
        <section key={i} className="rounded-lg border border-border bg-bgElev p-4">
          <h3 className="text-lg font-semibold text-text mb-3">{sec.title || sec.id || `Section ${i + 1}`}</h3>
          <div className="text-subtext text-sm leading-relaxed whitespace-pre-wrap">{sec.text || sec.content || ''}</div>
          {sec.bullets?.length > 0 && (
            <ul className="mt-3 list-disc list-inside text-subtext text-sm space-y-1">
              {sec.bullets.map((b: string, j: number) => <li key={j}>{b}</li>)}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

export default function SandboxPage() {
  const [state, setState] = useState<SandboxState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SandboxDraft>({
    birth: null,
    baseSnapshot: null,
    overrides: { planets: {} },
    overriddenSnapshot: null,
  });
  const [report, setReport] = useState<SandboxReport | null>(null);
  const [constrainToHouse, setConstrainToHouse] = useState(true);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<{ viz?: string; report?: string; audio?: string } | null>(null);
  const [lastSnapshotForCompose, setLastSnapshotForCompose] = useState<EphemerisSnapshot | null>(null);
  const [exportId, setExportId] = useState<string | null>(null);
  const [planHash, setPlanHash] = useState<string | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const snapshotSequenceRef = useRef(0);

  const updateSnapshot = useCallback(async (birth: SandboxBirth, overrides: SandboxOverrides) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    const sequenceId = ++snapshotSequenceRef.current;
    updateTimeoutRef.current = setTimeout(async () => {
      if (sequenceId !== snapshotSequenceRef.current) return;
      setState('syncing_overrides');
      const controller = new AbortController();
      abortControllerRef.current = controller;
      try {
        const base = getApiBaseUrl();
        const res = await fetch(`${base}/api/sandbox/snapshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ birth, overrides: normalizeOverrides(overrides) }),
          signal: controller.signal,
        });
        if (sequenceId !== snapshotSequenceRef.current) return;
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data?.error ?? data?.message) || `Snapshot failed: ${res.status}`);
        setDraft((prev) => ({ ...prev, overriddenSnapshot: data.snapshot, hash: data.meta }));
        setState('ready_report');
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setState('error');
          setError(err.message);
        }
      } finally {
        if (sequenceId === snapshotSequenceRef.current) abortControllerRef.current = null;
      }
    }, 300);
  }, []);

  const handleBirthSubmit = useCallback(async (birth: SandboxBirth) => {
    setState('loading_base');
    setError(null);
    setGenerateError(null);
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/sandbox/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birth, overrides: { planets: {} } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data?.error ?? data?.message) || 'Failed to load chart');
      setDraft({
        birth,
        baseSnapshot: data.snapshot,
        overrides: { planets: {} },
        overriddenSnapshot: data.snapshot,
        hash: data.meta,
      });
      setState('ready_builder');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Failed to load birth data');
      throw err;
    }
  }, []);

  const handleOverrideChange = useCallback((planet: PlanetKey, lonDeg: number | null) => {
    setDraft((prev) => {
      const newOverrides: SandboxOverrides = { ...prev.overrides, planets: { ...prev.overrides.planets } };
      if (lonDeg === null) delete newOverrides.planets[planet];
      else newOverrides.planets[planet] = { lonDeg: roundDegree(lonDeg) };
      const normalized = normalizeOverrides(newOverrides);
      if (prev.overriddenSnapshot && prev.birth) {
        const updatedPlanets = prev.overriddenSnapshot.planets.map((p) =>
          p.name === planet ? { ...p, lon: lonDeg !== null ? roundDegree(lonDeg) : p.lon } : p
        );
        updateSnapshot(prev.birth, normalized);
        return { ...prev, overrides: normalized, overriddenSnapshot: { ...prev.overriddenSnapshot, planets: updatedPlanets } };
      }
      return { ...prev, overrides: normalized };
    });
  }, [updateSnapshot]);

  const handleResetAllOverrides = useCallback(() => {
    if (!draft.birth || !draft.baseSnapshot) return;
    const empty: SandboxOverrides = { planets: {} };
    setDraft((prev) => ({ ...prev, overrides: empty, overriddenSnapshot: prev.baseSnapshot }));
    updateSnapshot(draft.birth, empty);
    setState('ready_builder');
  }, [draft.birth, draft.baseSnapshot, updateSnapshot]);

  const handleResetPlanet = useCallback((planet: PlanetKey) => handleOverrideChange(planet, null), [handleOverrideChange]);

  const canGenerate = draft.birth && (draft.overriddenSnapshot || draft.baseSnapshot) && draft.hash?.combinedHash;
  const handleGenerate = useCallback(async () => {
    if (!canGenerate || !draft.birth) return;
    setGenerateLoading(true);
    setGenerateError(null);
    setExportId(null);
    setPlanHash(null);
    const base = getApiBaseUrl();
    const combinedHash = draft.hash!.combinedHash!;
    let snapshot: EphemerisSnapshot | null = null;

    try {
      const snapRes = await fetch(`${base}/api/sandbox/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birth: draft.birth, overrides: normalizeOverrides(draft.overrides) }),
      });
      const snapData = await snapRes.json().catch(() => ({}));
      if (!snapRes.ok) {
        setGenerateError({ viz: (snapData?.error ?? snapData?.message) || `Snapshot: ${snapRes.status}` });
        setGenerateLoading(false);
        return;
      }
      snapshot = snapData.snapshot;
      setLastSnapshotForCompose(snapshot);
      const seed = snapData.meta?.combinedHash ?? combinedHash;

      const reportRes = await fetch(`${base}/api/sandbox/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birth: draft.birth, overrides: normalizeOverrides(draft.overrides), seed }),
      });
      const reportData = await reportRes.json().catch(() => ({}));
      if (!reportRes.ok) {
        setGenerateError({ report: (reportData?.error ?? reportData?.message) || `Report: ${reportRes.status}` });
        setReport(null);
      } else {
        setReport(reportData);
      }

      if (!snapshot) {
        setGenerateError((e) => ({ ...e, audio: 'No snapshot available for compose' }));
        setGenerateLoading(false);
        return;
      }
      const composeRes = await fetch(`${base}/api/compose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'sandbox',
          controls: SANDBOX_CONTROLS,
          seed: seed,
          overriddenSnapshot: snapshot,
        }),
      });
      const composeData = await composeRes.json().catch(() => ({}));
      if (!composeRes.ok) {
        setGenerateError((e) => ({ ...e, audio: (composeData?.error ?? composeData?.message) || `Compose: ${composeRes.status}` }));
      } else {
        if (composeData.export_id) setExportId(composeData.export_id);
        if (composeData.hashes?.plan_sha256) setPlanHash(composeData.hashes.plan_sha256);
      }
    } catch (e) {
      setGenerateError({ audio: e instanceof Error ? e.message : 'Generate failed' });
    } finally {
      setGenerateLoading(false);
    }
  }, [canGenerate, draft]);

  const currentSnapshot = draft.overriddenSnapshot || draft.baseSnapshot;
  const basePositions: Record<string, number> = {};
  if (draft.baseSnapshot) for (const p of draft.baseSnapshot.planets) basePositions[p.name] = p.lon;
  const cusps = currentSnapshot?.houses ?? [];

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-text">Sandbox</h1>
          <p className="text-lg text-subtext max-w-2xl mx-auto">
            Chart lab: enter birth data, then drag planets or type degrees. Generate viz, report, and audio from the same chart state.
          </p>
          <p className="text-xs text-subtext/80">Houses are from birth chart geometry in Phase 6.</p>
        </motion.div>

        {state === 'idle' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold text-text mb-4">Enter birth data</h2>
            <BirthDataForm onSubmit={handleBirthSubmit} />
            <div className="mt-6 w-full aspect-square max-w-md mx-auto bg-bgElev border border-border rounded-2xl flex items-center justify-center">
              <p className="text-subtext text-sm">Enter birth data to see the wheel</p>
            </div>
          </motion.div>
        )}

        {state === 'loading_base' && (
          <div className="card max-w-2xl mx-auto text-center">
            <p className="text-subtext">Loading chart...</p>
          </div>
        )}

        {state === 'error' && error && (
          <div className="card max-w-2xl mx-auto">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              <p className="font-semibold mb-2">Error</p>
              <p className="text-sm">{error}</p>
              <button onClick={() => { setState('idle'); setError(null); setDraft({ birth: null, baseSnapshot: null, overrides: { planets: {} }, overriddenSnapshot: null }); }} className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm">Reset</button>
            </div>
          </div>
        )}

        {(state === 'ready_builder' || state === 'syncing_overrides' || state === 'ready_report') && draft.birth && (
          <div className="grid lg:grid-cols-[1fr_300px] gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-text">Wheel</h2>
                    <p className="text-sm text-subtext mt-1">Drag planets or use degree inputs. Houses are from birth chart geometry in Phase 6.</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-subtext">
                    <input type="checkbox" checked={constrainToHouse} onChange={(e) => setConstrainToHouse(e.target.checked)} className="rounded" />
                    Constrain to house
                  </label>
                  {Object.keys(draft.overrides.planets).length > 0 && (
                    <button onClick={handleResetAllOverrides} className="px-3 py-1.5 text-sm bg-bgElev hover:bg-bgElev/80 border border-border rounded-lg text-subtext hover:text-text">Reset All</button>
                  )}
                </div>
                <div className="w-full aspect-square bg-bgElev border border-border rounded-2xl p-4 relative">
                  <WheelCanvasBuilder
                    snapshot={currentSnapshot}
                    overrides={draft.overrides}
                    onOverrideChange={(planet, lonDeg) => handleOverrideChange(planet, lonDeg)}
                    isUpdating={state === 'syncing_overrides'}
                    constrainToHouse={constrainToHouse}
                  />
                </div>
              </div>

              <div className="card">
                <h2 className="text-xl font-semibold text-text mb-4">Generate</h2>
                {!canGenerate && (
                  <p className="text-sm text-subtext mb-4">Load birth data and wait for the chart to sync. Generate is available once the wheel is ready.</p>
                )}
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate || generateLoading}
                  className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generateLoading ? 'Generating…' : 'Generate viz, report & audio'}
                </button>
                {generateError && (generateError.viz || generateError.report || generateError.audio) && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {generateError.viz && <p>Viz: {generateError.viz}</p>}
                    {generateError.report && <p>Report: {generateError.report}</p>}
                    {generateError.audio && <p>Audio: {generateError.audio}</p>}
                  </div>
                )}
                {report && (
                  <div className="mt-6 space-y-4">
                    {report.personality && (
                      <section className="rounded-lg border border-border bg-bgElev p-4">
                        <h3 className="text-lg font-semibold text-text mb-3">Personality</h3>
                        <div className="text-subtext text-sm">{report.personality.summary || JSON.stringify(report.personality, null, 2)}</div>
                      </section>
                    )}
                    {report.guidance && (
                      <section className="rounded-lg border border-border bg-bgElev p-4">
                        <h3 className="text-lg font-semibold text-text mb-3">Guidance</h3>
                        <div className="text-subtext text-sm">{report.guidance.advice || JSON.stringify(report.guidance, null, 2)}</div>
                      </section>
                    )}
                    {report.explanation && <ExplainerSections explanation={report.explanation} />}
                  </div>
                )}
                {exportId && (
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <a href={`${getApiBaseUrl() || ''}/api/exports/${exportId}`} download={`${exportId}-30s.wav`} className="px-4 py-2 bg-white/10 border border-border rounded-lg font-medium hover:bg-white/15">Download WAV (30s)</a>
                    <audio src={`/api/exports/${exportId}`} controls className="max-w-full" />
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="card">
                <DegreePanel overrides={draft.overrides} basePositions={basePositions} cusps={cusps.length === 12 ? cusps : undefined} onOverrideChange={handleOverrideChange} onResetPlanet={handleResetPlanet} />
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
