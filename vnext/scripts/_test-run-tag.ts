// vnext/scripts/_test-run-tag.ts
// Deterministic test run tagging for DB-backed slices.
//
// Goals:
// - In CI, require a stable run identifier (from CI env or TEST_RUN_TAG).
// - Locally, allow a default tag but support TEST_RUN_TAG for reproducibility.
// - Provide a small helper to derive deterministic day offsets from a tag.

import crypto from 'crypto';

const IS_CI = process.env.CI === 'true' || process.env.CI === '1';

function pickFirstDefined(...vals: Array<string | undefined>): string | undefined {
  for (const v of vals) {
    if (v && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

export function getTestRunTag(scriptName: string): string {
  const env = process.env;

  // Prefer explicit TEST_RUN_TAG when set.
  const explicitTag = env.TEST_RUN_TAG;

  // Common CI identifiers.
  const ciRunId =
    env.GITHUB_RUN_ID ||
    env.GITHUB_SHA ||
    env.CI_PIPELINE_ID ||
    env.BUILD_BUILDID ||
    env.BUILD_BUILDNUMBER;

  const chosen = pickFirstDefined(explicitTag, ciRunId);

  if (IS_CI && !chosen) {
    throw new Error(
      `[${scriptName}] CI=1 but no CI run identifier or TEST_RUN_TAG is set. ` +
        'Set TEST_RUN_TAG (or one of GITHUB_RUN_ID, GITHUB_SHA, CI_PIPELINE_ID, BUILD_BUILDID) ' +
        'to a stable string so DB-backed seeds are reproducible.'
    );
  }

  return chosen ?? 'local';
}

export function deriveDeterministicDay(params: {
  tag: string;
  salt: string;
  minDay: number;
  maxDay: number;
}): number {
  const { tag, salt, minDay, maxDay } = params;
  if (maxDay < minDay) {
    throw new Error('deriveDeterministicDay: maxDay must be >= minDay');
  }
  const hash = crypto.createHash('sha256').update(`${tag}:${salt}`).digest('hex');
  const fragment = hash.slice(0, 4); // 16 bits -> 0..65535
  const n = parseInt(fragment, 16);
  const range = maxDay - minDay + 1;
  return minDay + (n % range);
}

