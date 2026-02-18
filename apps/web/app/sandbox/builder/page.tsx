'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../../../src/components/AppShell';
import { BirthDataForm } from '../../../src/components/sandbox/BirthDataForm';
import { WheelCanvasBuilder } from '../../../src/components/sandbox/WheelCanvasBuilder';
import { DegreePanel } from '../../../src/components/sandbox/DegreePanel';
import type { SandboxDraft, SandboxBirth, SandboxOverrides, PlanetKey, EphemerisSnapshot, SandboxReport } from '../../../src/types/sandbox';
import { getApiBaseUrl } from '../../../src/core/api-base';

const PLANET_ORDER: PlanetKey[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

/**
 * Phase 4C: Sandbox state machine
 */
type SandboxState = 
  | 'idle'
  | 'loading_base'
  | 'ready_builder'
  | 'syncing_overrides'
  | 'ready_report'
  | 'generating_report'
  | 'report_ready'
  | 'error';

/**
 * Canonical degree rounding: 0.1° precision for determinism
 */
function roundDegree(lonDeg: number): number {
  return Math.round(lonDeg * 10) / 10;
}

/**
 * Normalize overrides: sort planet keys and round degrees
 */
function normalizeOverrides(overrides: SandboxOverrides): SandboxOverrides {
  const sortedPlanets: Partial<Record<PlanetKey, { lonDeg: number }>> = {};
  const planetKeys = Object.keys(overrides.planets || {}) as PlanetKey[];
  planetKeys.sort((a, b) => a.localeCompare(b));
  
  for (const key of planetKeys) {
    const override = overrides.planets[key];
    if (override) {
      sortedPlanets[key] = { lonDeg: roundDegree(override.lonDeg) };
    }
  }
  
  return {
    planets: sortedPlanets,
    angles: overrides.angles,
  };
}

function ExplainerSections({ explanation }: { explanation: any }) {
  if (!explanation || !explanation.sections) return null;
  
  const sections = Array.isArray(explanation.sections) ? explanation.sections : [];
  
  return (
    <div className="space-y-6">
      {sections.map((sec: any, i: number) => (
        <section key={i} className="rounded-lg border border-border bg-bgElev p-4">
          <h3 className="text-lg font-semibold text-text mb-3">
            {sec.title || sec.id || `Section ${i + 1}`}
          </h3>
          <div className="text-subtext text-sm leading-relaxed whitespace-pre-wrap">
            {sec.text || sec.content || ''}
          </div>
          {sec.bullets && sec.bullets.length > 0 && (
            <ul className="mt-3 list-disc list-inside text-subtext text-sm space-y-1">
              {sec.bullets.map((b: string, j: number) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

export default function SandboxBuilderPage() {
  const [state, setState] = useState<SandboxState>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const [draft, setDraft] = useState<SandboxDraft>({
    birth: null,
    baseSnapshot: null,
    overrides: { planets: {} },
    overriddenSnapshot: null,
  });
  
  const [report, setReport] = useState<SandboxReport | null>(null);
  
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reportAbortControllerRef = useRef<AbortController | null>(null);
  const snapshotSequenceRef = useRef<number>(0);
  const reportSequenceRef = useRef<number>(0);

  // Debounced snapshot update with sequence ID
  const updateSnapshot = useCallback(async (birth: SandboxBirth, overrides: SandboxOverrides) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Clear previous timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    // Increment sequence
    const sequenceId = ++snapshotSequenceRef.current;
    
    // Set new timeout
    updateTimeoutRef.current = setTimeout(async () => {
      // Check if this is still the latest request
      if (sequenceId !== snapshotSequenceRef.current) {
        return; // Outdated request, ignore
      }
      
      setState('syncing_overrides');
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      try {
        const normalized = normalizeOverrides(overrides);
        const base = getApiBaseUrl();
        const res = await fetch(`${base}/api/sandbox/snapshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ birth, overrides: normalized }),
          signal: controller.signal,
        });
        
        // Check sequence again after fetch
        if (sequenceId !== snapshotSequenceRef.current) {
          return; // Outdated response, ignore
        }
        
        if (!res.ok) {
          throw new Error(`Failed to update snapshot: ${res.status}`);
        }
        
        const data = await res.json();
        setDraft((prev) => ({
          ...prev,
          overriddenSnapshot: data.snapshot,
          hash: data.meta,
        }));
        setState('ready_report');
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Snapshot update failed:', err);
          setState('error');
          setError(err.message);
        }
      } finally {
        if (sequenceId === snapshotSequenceRef.current) {
          abortControllerRef.current = null;
        }
      }
    }, 300);
  }, []);

  const handleBirthSubmit = useCallback(async (birth: SandboxBirth) => {
    setState('loading_base');
    setError(null);
    
    try {
      const base = getApiBaseUrl();
      // Get base snapshot
      const res = await fetch(`${base}/api/sandbox/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birth, overrides: { planets: {} } }),
      });
      
      if (!res.ok) {
        throw new Error(`Failed to load chart: ${res.status}`);
      }
      
      const data = await res.json();
      const snapshot = data.snapshot;
      
      setDraft({
        birth,
        baseSnapshot: snapshot,
        overrides: { planets: {} },
        overriddenSnapshot: snapshot,
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
      const newOverrides: SandboxOverrides = {
        ...prev.overrides,
        planets: { ...prev.overrides.planets },
      };
      
      if (lonDeg === null) {
        delete newOverrides.planets[planet];
      } else {
        // Round to 0.1° precision
        newOverrides.planets[planet] = { lonDeg: roundDegree(lonDeg) };
      }
      
      // Normalize overrides (sort keys)
      const normalized = normalizeOverrides(newOverrides);
      
      // Optimistically update local snapshot
      if (prev.overriddenSnapshot) {
        const updatedPlanets = prev.overriddenSnapshot.planets.map((p) =>
          p.name === planet ? { ...p, lon: lonDeg !== null ? roundDegree(lonDeg) : p.lon } : p
        );
        const optimisticSnapshot: EphemerisSnapshot = {
          ...prev.overriddenSnapshot,
          planets: updatedPlanets,
        };
        
        // Trigger debounced network update
        if (prev.birth) {
          updateSnapshot(prev.birth, normalized);
        }
        
        return {
          ...prev,
          overrides: normalized,
          overriddenSnapshot: optimisticSnapshot,
        };
      }
      
      return { ...prev, overrides: normalized };
    });
  }, [updateSnapshot]);
  
  const handleResetAllOverrides = useCallback(() => {
    if (!draft.birth || !draft.baseSnapshot) return;
    
    const emptyOverrides: SandboxOverrides = { planets: {} };
    setDraft((prev) => ({
      ...prev,
      overrides: emptyOverrides,
      overriddenSnapshot: prev.baseSnapshot,
    }));
    
    // Reset to base snapshot state
    updateSnapshot(draft.birth, emptyOverrides);
    setState('ready_builder');
  }, [draft.birth, draft.baseSnapshot, updateSnapshot]);
  
  const handleResetPlanet = useCallback((planet: PlanetKey) => {
    handleOverrideChange(planet, null);
  }, [handleOverrideChange]);

  const handleGenerateReport = useCallback(async () => {
    if (!draft.birth) return;
    
    // Abort previous report request
    if (reportAbortControllerRef.current) {
      reportAbortControllerRef.current.abort();
    }
    
    const sequenceId = ++reportSequenceRef.current;
    setState('generating_report');
    setError(null);
    
    const controller = new AbortController();
    reportAbortControllerRef.current = controller;
    
    try {
      const normalized = normalizeOverrides(draft.overrides);
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/sandbox/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birth: draft.birth,
          overrides: normalized,
          seed: `sandbox-${Date.now()}`,
        }),
        signal: controller.signal,
      });
      
      // Check sequence after fetch
      if (sequenceId !== reportSequenceRef.current) {
        return; // Outdated response
      }
      
      if (!res.ok) {
        throw new Error(`Failed to generate report: ${res.status}`);
      }
      
      const data = await res.json();
      setReport(data);
      setState('report_ready');
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setState('error');
        setError(err.message);
      }
    } finally {
      if (sequenceId === reportSequenceRef.current) {
        reportAbortControllerRef.current = null;
      }
    }
  }, [draft]);

  const currentSnapshot = draft.overriddenSnapshot || draft.baseSnapshot;
  const basePositions: Record<string, number> = {};
  if (draft.baseSnapshot) {
    for (const p of draft.baseSnapshot.planets) {
      basePositions[p.name] = p.lon;
    }
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl font-bold text-text">Sandbox Builder</h1>
          <p className="text-lg text-subtext max-w-2xl mx-auto">
            Start with birth data, then drag planets or type degrees to explore different chart configurations.
          </p>
        </motion.div>

        {/* Step 1: Birth Data */}
        {state === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card max-w-2xl mx-auto"
          >
            <h2 className="text-xl font-semibold text-text mb-4">Step 1: Enter Birth Data</h2>
            <BirthDataForm onSubmit={handleBirthSubmit} />
          </motion.div>
        )}
        
        {/* Loading Base */}
        {state === 'loading_base' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card max-w-2xl mx-auto text-center"
          >
            <p className="text-subtext">Loading chart...</p>
          </motion.div>
        )}
        
        {/* Error State */}
        {state === 'error' && error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card max-w-2xl mx-auto"
          >
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              <p className="font-semibold mb-2">Error</p>
              <p className="text-sm">{error}</p>
              <button
                onClick={() => {
                  setState('idle');
                  setError(null);
                  setDraft({
                    birth: null,
                    baseSnapshot: null,
                    overrides: { planets: {} },
                    overriddenSnapshot: null,
                  });
                }}
                className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm"
              >
                Reset
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Builder */}
        {(state === 'ready_builder' || state === 'syncing_overrides' || state === 'ready_report' || state === 'generating_report' || state === 'report_ready') && draft.birth && (
          <div className="grid lg:grid-cols-[1fr_300px] gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-text">Step 2: Adjust Planets</h2>
                    <p className="text-sm text-subtext mt-1">
                      Drag planets around the wheel or use the degree inputs on the right.
                    </p>
                  </div>
                  {Object.keys(draft.overrides.planets).length > 0 && (
                    <button
                      onClick={handleResetAllOverrides}
                      className="px-3 py-1.5 text-sm bg-bgElev hover:bg-bgElev/80 border border-border rounded-lg text-subtext hover:text-text"
                    >
                      Reset All
                    </button>
                  )}
                </div>
                <div className="w-full aspect-square bg-bgElev border border-border rounded-2xl p-4 relative">
                  <WheelCanvasBuilder
                    snapshot={currentSnapshot}
                    overrides={draft.overrides}
                    onOverrideChange={(planet, lonDeg) => handleOverrideChange(planet, lonDeg)}
                    isUpdating={state === 'syncing_overrides'}
                  />
                  {state === 'syncing_overrides' && (
                    <div className="absolute top-4 right-4 px-3 py-1.5 bg-bgElev/90 border border-border rounded-lg text-xs text-subtext">
                      Syncing overrides...
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: Report */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-text">Step 3: Generate Report</h2>
                  <button
                    onClick={handleGenerateReport}
                    disabled={state === 'generating_report' || state === 'syncing_overrides'}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {state === 'generating_report' ? 'Generating...' : 'Generate Report'}
                  </button>
                </div>

                {state === 'generating_report' && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-sm mb-4">
                    Generating report from current snapshot...
                  </div>
                )}

                {report && (
                  <div className="space-y-6">
                    {report.personality && (
                      <section className="rounded-lg border border-border bg-bgElev p-4">
                        <h3 className="text-lg font-semibold text-text mb-3">Personality</h3>
                        <div className="text-subtext text-sm">
                          {report.personality.summary || JSON.stringify(report.personality, null, 2)}
                        </div>
                      </section>
                    )}
                    
                    {report.guidance && (
                      <section className="rounded-lg border border-border bg-bgElev p-4">
                        <h3 className="text-lg font-semibold text-text mb-3">Guidance</h3>
                        <div className="text-subtext text-sm">
                          {report.guidance.advice || JSON.stringify(report.guidance, null, 2)}
                        </div>
                      </section>
                    )}
                    
                    {report.explanation && (
                      <ExplainerSections explanation={report.explanation} />
                    )}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Right Panel: Degree Inputs */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="card">
                <DegreePanel
                  overrides={draft.overrides}
                  basePositions={basePositions}
                  onOverrideChange={handleOverrideChange}
                  onResetPlanet={handleResetPlanet}
                />
              </div>

              {/* Debug Panel (dev only) */}
              {process.env.NODE_ENV === 'development' && draft.hash && (
                <div className="card bg-bgElev/50">
                  <h3 className="text-sm font-semibold text-text mb-3">Debug Info</h3>
                  <div className="space-y-2 text-xs font-mono text-subtext">
                    <div>
                      <span className="text-text">baseHash:</span> {draft.hash.birthHash?.substring(0, 16)}...
                    </div>
                    <div>
                      <span className="text-text">overridesHash:</span> {draft.hash.overridesHash?.substring(0, 16)}...
                    </div>
                    <div>
                      <span className="text-text">combinedHash:</span> {draft.hash.combinedHash?.substring(0, 16)}...
                    </div>
                    {report?.meta?.combinedHash && (
                      <div>
                        <span className="text-text">reportHash:</span> {report.meta.combinedHash.substring(0, 16)}...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
