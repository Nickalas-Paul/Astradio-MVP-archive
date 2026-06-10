'use client';

import { IdentityMarkdown } from '@/components/shared/IdentityMarkdown';
import { usePlacementHighlight } from '@/core/PlacementHighlightContext';
import { IDENTITY_TIER_PLANETS, parsePlanetNamesFromAspectKey } from '@/core/planet-identity';
import { mapExplanationToSections } from '@/components/profile/shared/profile-reading-utils';
import type {
  SandboxBirth,
  SandboxOverrides,
  EphemerisSnapshot,
  SandboxReport,
  SandboxResolvedSession,
  SandboxSynastryReportV1,
} from '../../src/types/sandbox';
import {
  getActiveSlotIndexFromCompositionInput,
  parsePersistedSandboxState,
  type SandboxCompositionModelState,
} from '../../src/lib/sandbox-composition-state';

function sectionHighlightPlanets(sec: {
  id: string;
  planets?: string[];
  aspectKeys?: string[];
}): string[] {
  if (sec.planets?.length) return sec.planets;
  if (sec.id === 'aspects' && sec.aspectKeys?.length) {
    return [...new Set(sec.aspectKeys.flatMap((k) => parsePlanetNamesFromAspectKey(k)))];
  }
  return IDENTITY_TIER_PLANETS[sec.id] ?? [];
}

export function ExplainerSections({ explanation }: { explanation: unknown }) {
  const { setHighlight, clearHighlight } = usePlacementHighlight();
  const sections = mapExplanationToSections(explanation);
  if (!sections.length) return null;

  return (
    <div className="space-y-6">
      {sections.map((sec) => {
        const planets = sectionHighlightPlanets(sec);
        return (
          <section
            key={sec.id}
            className="rounded-lg border border-border bg-bgElev p-4"
            onMouseEnter={() => {
              if (planets.length) setHighlight(planets);
            }}
            onMouseLeave={() => clearHighlight()}
          >
            <h2 className="reading-section-header mb-3 first:mt-0">
              {sec.title || sec.id}
            </h2>
            <IdentityMarkdown content={sec.text} sectionPlanets={planets} />
            {sec.bullets?.length ? (
              <ul className="mt-3 list-disc list-inside text-text-secondary text-sm space-y-1">
                {sec.bullets.map((b: string, j: number) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

export function activeSlotBirth(model: SandboxCompositionModelState): SandboxBirth | undefined {
  const i = getActiveSlotIndexFromCompositionInput(model.compositionInput);
  return model.compositionInput.slots[i]?.ephemeris_birth;
}

export function activeSlotOverrides(model: SandboxCompositionModelState): SandboxOverrides {
  const i = getActiveSlotIndexFromCompositionInput(model.compositionInput);
  return model.compositionInput.slots[i]?.overrides ?? { planets: {} };
}

export function buildLastResolveFromLoadedRow(
  comp: Record<string, unknown>,
  parsed: ReturnType<typeof parsePersistedSandboxState>,
  snapshot: EphemerisSnapshot | null
): SandboxResolvedSession | null {
  const report = (comp.report ?? null) as SandboxReport | null;
  const planSha256 = typeof comp.plan_hash === 'string' ? comp.plan_hash : null;
  const exportId = typeof comp.export_id === 'string' ? comp.export_id : null;
  const combinedHashUsed =
    typeof comp.seed === 'string' ? comp.seed : typeof comp.vector_hash === 'string' ? comp.vector_hash : null;

  const body = parsed.lastSubmittedResolveBody;
  if (body && planSha256) {
    const full =
      parsed.fullResolveResponse && Object.keys(parsed.fullResolveResponse).length > 0
        ? parsed.fullResolveResponse
        : ({} as Record<string, unknown>);
    const env =
      report && typeof report === 'object' && 'artifact_envelope' in report
        ? (report as SandboxReport & { artifact_envelope?: Record<string, unknown> }).artifact_envelope
        : undefined;
    const canonicalSlotOrder = Array.isArray(full.canonical_slot_order)
      ? (full.canonical_slot_order as string[])
      : env && Array.isArray(env.canonical_slot_order)
        ? (env.canonical_slot_order as string[])
        : null;
    const canonicalInputHash =
      typeof full.canonical_input_hash === 'string'
        ? full.canonical_input_hash
        : env && typeof env.canonical_input_hash === 'string'
          ? env.canonical_input_hash
          : null;
    const canonicalObjectHash =
      report?.meta?.canonical_object_hash ??
      (typeof full.canonical_object_hash === 'string' ? full.canonical_object_hash : null) ??
      null;

    const safeReport =
      report ??
      ({
        features: [],
        personality: null as unknown as SandboxReport['personality'],
        guidance: null as unknown as SandboxReport['guidance'],
        explanation: { spec: 'UnifiedSpecV1.1', sections: [] },
        seed: combinedHashUsed ?? '',
        meta: { combinedHash: combinedHashUsed ?? '' },
      } as SandboxReport);

    return {
      source: 'live_resolve',
      fullResponse: full,
      lastSubmittedResolveBody: body,
      snapshotUsed: snapshot,
      combinedHashUsed: combinedHashUsed ?? '',
      planSha256,
      canonicalSlotOrder,
      canonicalInputHash,
      canonicalObjectHash,
      report: safeReport,
      exportId,
      lastComposeProvider: null,
      exportUnavailableReason: exportId ? null : { summary: 'Export unavailable' },
    };
  }

  if (!report && !planSha256) return null;

  return {
    source: 'loaded_row',
    report,
    planSha256,
    exportId,
    combinedHashUsed,
    lastSubmittedResolveBody: null,
  };
}

/** Thin extraction only: one of compose | aggregate per response, never mixed. */
export function extractSandboxResolvePayload(resolveData: Record<string, unknown>): {
  explanation: unknown;
  planSha256: string;
  exportId: string | null;
  exportAvailable: boolean;
  sandboxSynastryReport: SandboxSynastryReportV1 | null;
} | null {
  const compose = resolveData.compose;
  const aggregate = resolveData.aggregate;
  const source =
    compose && typeof compose === 'object'
      ? (compose as Record<string, unknown>)
      : aggregate && typeof aggregate === 'object'
        ? (aggregate as Record<string, unknown>)
        : null;
  if (!source) return null;
  const explanation = source.explanation;
  const hashes = source.hashes as { plan_sha256?: string } | undefined;
  const planSha256 = hashes?.plan_sha256;
  const exportIdRaw = source.export_id;
  const exportId = typeof exportIdRaw === 'string' && exportIdRaw.length > 0 ? exportIdRaw : null;
  const exportAvailable = exportId != null;
  if (!explanation || typeof explanation !== 'object' || !planSha256 || typeof planSha256 !== 'string' || !planSha256.trim()) {
    return null;
  }
  const rawSynastry = resolveData.sandboxSynastryReport;
  const sandboxSynastryReport =
    rawSynastry &&
    typeof rawSynastry === 'object' &&
    (rawSynastry as SandboxSynastryReportV1).schema_version === 'sandbox_synastry_v1'
      ? (rawSynastry as SandboxSynastryReportV1)
      : null;
  return { explanation, planSha256, exportId, exportAvailable, sandboxSynastryReport };
}

export function extractPlanSha256FromResolveResponse(resolveData: Record<string, unknown>): string | undefined {
  const compose = resolveData.compose;
  if (compose && typeof compose === 'object') {
    const h = (compose as Record<string, unknown>).hashes as { plan_sha256?: string } | undefined;
    if (typeof h?.plan_sha256 === 'string' && h.plan_sha256.trim()) return h.plan_sha256;
  }
  const aggregate = resolveData.aggregate;
  if (aggregate && typeof aggregate === 'object') {
    const h = (aggregate as Record<string, unknown>).hashes as { plan_sha256?: string } | undefined;
    if (typeof h?.plan_sha256 === 'string' && h.plan_sha256.trim()) return h.plan_sha256;
  }
  return undefined;
}
