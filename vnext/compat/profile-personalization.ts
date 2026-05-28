/**
 * Phase 9A-1 — validation for PATCH /api/profile personalization fields.
 */

export const PROFILE_DISPLAY_NAME_MIN = 1;
export const PROFILE_DISPLAY_NAME_MAX = 50;
export const PROFILE_BIO_MAX = 250;
export const PROFILE_LOOKING_FOR_MAX = 250;
export const PROFILE_CHART_HIGHLIGHTS_MAX = 3;

const PHONE_PATTERN = /\d{3}[-.]?\d{3}[-.]?\d{4}/;
const EMAIL_PATTERN = /\S+@\S+\.\S+/;
const URL_PATTERN = /https?:\/\//i;

export type ProfilePersonalizationPatch = {
  displayName?: string;
  bio?: string | null;
  lookingFor?: string | null;
  chartHighlights?: string[] | null;
};

export function bioContainsDisallowedContent(bio: string): string | null {
  if (PHONE_PATTERN.test(bio)) return 'bio must not contain phone numbers';
  if (EMAIL_PATTERN.test(bio)) return 'bio must not contain email addresses';
  if (URL_PATTERN.test(bio)) return 'bio must not contain URLs';
  return null;
}

function parseNullableString(
  value: unknown,
  field: string,
  maxLen: number,
  opts?: { validateContent?: (s: string) => string | null }
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== 'string') {
    return { ok: false, error: `${field} must be a string or null` };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > maxLen) {
    return { ok: false, error: `${field} must be at most ${maxLen} characters` };
  }
  if (opts?.validateContent) {
    const contentErr = opts.validateContent(trimmed);
    if (contentErr) return { ok: false, error: contentErr };
  }
  return { ok: true, value: trimmed };
}

function parseChartHighlights(
  value: unknown
): { ok: true; value: string[] | null } | { ok: false; error: string } {
  if (value === null) return { ok: true, value: null };
  if (!Array.isArray(value)) {
    return { ok: false, error: 'chartHighlights must be an array of strings or null' };
  }
  if (value.length > PROFILE_CHART_HIGHLIGHTS_MAX) {
    return {
      ok: false,
      error: `chartHighlights must have at most ${PROFILE_CHART_HIGHLIGHTS_MAX} items`,
    };
  }
  const items: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (typeof item !== 'string') {
      return { ok: false, error: 'chartHighlights must be an array of strings' };
    }
    const trimmed = item.trim();
    if (!trimmed) {
      return { ok: false, error: 'chartHighlights items must be non-empty strings' };
    }
    items.push(trimmed);
  }
  return { ok: true, value: items.length > 0 ? items : null };
}

/**
 * Parse and validate personalization fields present on the PATCH body.
 * Only keys present on `body` are included in the returned patch.
 */
export function parseProfilePersonalizationPatch(
  body: Record<string, unknown>
): { ok: true; patch: ProfilePersonalizationPatch } | { ok: false; error: string } {
  const patch: ProfilePersonalizationPatch = {};

  if (Object.prototype.hasOwnProperty.call(body, 'displayName')) {
    if (typeof body.displayName !== 'string') {
      return { ok: false, error: 'displayName must be a string' };
    }
    const trimmed = body.displayName.trim();
    if (trimmed.length < PROFILE_DISPLAY_NAME_MIN || trimmed.length > PROFILE_DISPLAY_NAME_MAX) {
      return {
        ok: false,
        error: `displayName must be ${PROFILE_DISPLAY_NAME_MIN}-${PROFILE_DISPLAY_NAME_MAX} characters`,
      };
    }
    patch.displayName = trimmed;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'bio')) {
    const bio = parseNullableString(body.bio, 'bio', PROFILE_BIO_MAX, {
      validateContent: bioContainsDisallowedContent,
    });
    if (!bio.ok) return bio;
    patch.bio = bio.value;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'lookingFor')) {
    const lf = parseNullableString(body.lookingFor, 'lookingFor', PROFILE_LOOKING_FOR_MAX);
    if (!lf.ok) return lf;
    patch.lookingFor = lf.value;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'chartHighlights')) {
    const ch = parseChartHighlights(body.chartHighlights);
    if (!ch.ok) return ch;
    patch.chartHighlights = ch.value;
  }

  return { ok: true, patch };
}

export function hasProfilePersonalizationKeys(body: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(body, 'displayName') ||
    Object.prototype.hasOwnProperty.call(body, 'bio') ||
    Object.prototype.hasOwnProperty.call(body, 'lookingFor') ||
    Object.prototype.hasOwnProperty.call(body, 'chartHighlights')
  );
}
