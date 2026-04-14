/**
 * Projection-local listen-register strings for mechanism arc rendering.
 * Role-aligned only: core, mechanism, experience, variation, implication.
 * Missing overrides fall back to deterministic shims, then to mechanism-register bundle text.
 */
import type { ClaimId } from '../../semantic/ontology-codes';
import type { ClaimExpressionBundle, ClaimOptionalRole } from './claim-expression-bundles';

export type ArcListenRole = 'core' | ClaimOptionalRole;

export type ClaimListenOverride = Partial<{
  core: readonly string[];
  mechanism: readonly string[];
  experience: readonly string[];
  variation: readonly string[];
  implication: readonly string[];
}>;

const OVERRIDES: Partial<Record<ClaimId, ClaimListenOverride>> = {};

function shimMechanismToListen(variants: readonly string[]): readonly string[] {
  return variants.map((s) =>
    s.replace(/^Mechanistically, the label /, 'In listening terms, the label ')
  );
}

function shimExperienceToListen(variants: readonly string[]): readonly string[] {
  return variants.map((s) =>
    s.replace(/^Many people notice this thread as /, 'On replay, the emphasis often reads as ')
  );
}

function shimVariationToListen(variants: readonly string[]): readonly string[] {
  return variants.map((s) => {
    if (s.startsWith('Mechanistically, the label ')) {
      return s.replace(/^Mechanistically, the label /, 'In register space, the label ');
    }
    if (s.startsWith('Many people notice this thread as ')) {
      return s.replace(/^Many people notice this thread as /, 'On replay, the line reads as ');
    }
    return s;
  });
}

/**
 * Variant strings for one arc role. `register === 'mechanism'` uses bundle mechanism-register only.
 * `register === 'listen'` uses optional overrides, else deterministic shims of mechanism-register lines.
 */
export function listenVariantsForArcRole(
  claimId: ClaimId,
  bundle: ClaimExpressionBundle,
  role: ArcListenRole,
  register: 'mechanism' | 'listen'
): readonly string[] {
  if (register === 'mechanism') {
    if (role === 'core') return bundle.core;
    const opt = bundle[role];
    if (opt && opt.length > 0) return opt;
    return [];
  }

  const o = OVERRIDES[claimId];
  const listenOnly = role === 'core' ? o?.core : o?.[role];
  if (listenOnly && listenOnly.length > 0) return listenOnly;

  if (role === 'core') return bundle.core;

  const base = bundle[role];
  if (!base || base.length === 0) return [];

  if (role === 'mechanism') return shimMechanismToListen(base);
  if (role === 'experience') return shimExperienceToListen(base);
  if (role === 'variation') return shimVariationToListen(base);
  return base;
}
