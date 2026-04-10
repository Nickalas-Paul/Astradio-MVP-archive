/**
 * Phase D — deterministic observational language lint (projection only).
 */

const FORBIDDEN: { re: RegExp; replacement: string }[] = [
  { re: /\bthis means\b/gi, replacement: 'this pattern may correlate with' },
  { re: /\balways\b/gi, replacement: 'often' },
  { re: /\bnever\b/gi, replacement: 'may not always' },
  { re: /\bguaranteed\b/gi, replacement: 'frequently suggested' },
  { re: /\bwill happen\b/gi, replacement: 'may tend to show up' },
];

const HEDGE_RE = /\b(may|tends to|tend to|often|frequently|can show up|sometimes|many cases|this configuration|this pattern)\b/i;

export function lintParagraph(text: string): { text: string; violations: string[] } {
  const violations: string[] = [];
  let t = text.trim();
  if (!t) return { text: t, violations };

  for (const { re, replacement } of FORBIDDEN) {
    if (re.test(t)) {
      violations.push(`forbidden:${re.source}`);
      t = t.replace(re, replacement);
    }
  }

  if (!HEDGE_RE.test(t)) {
    violations.push('missing_hedge');
    t = `In many cases, this pattern tends to show related tendencies: ${t}`;
  }

  return { text: t, violations };
}

export function lintSectionBody(body: string): { text: string; violations: string[] } {
  const parts = body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const all: string[] = [];
  const violations: string[] = [];
  for (const p of parts) {
    const r = lintParagraph(p);
    all.push(r.text);
    violations.push(...r.violations);
  }
  return { text: all.join('\n\n'), violations };
}
