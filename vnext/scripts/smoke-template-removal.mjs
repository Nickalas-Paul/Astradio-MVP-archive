#!/usr/bin/env node
/**
 * Phase 2 smoke helper: detect legacy template strings in composition output.
 */
import { fileURLToPath } from 'node:url';

export const BANNED_TEMPLATE_STRINGS = [
  'In many cases, this pattern tends to show related tendencies:',
  'Here, you see a baseline framing',
  'Elemental weight centers on',
  'The personal punch comes from',
  'water-weighted emphasis shows up',
  'Listeners often register this thread',
  'Both steady and quick layers count',
  'The balanced mood and water weight',
  'Mutable modality emphasis shows up',
  'Cardinal modality emphasis shows up',
  'Trait bridge:',
  'Interaction map:',
  'Field distribution:',
  'Sandbox delta:',
  'Subcluster note:',
  'Layering:',
  'Temporal integration:',
  'Contrast map:',
  'Pressure -> response:',
];

export async function checkForBannedStrings(reportText) {
  const text = String(reportText ?? '').toLowerCase();
  const found = BANNED_TEMPLATE_STRINGS.filter((bannedString) =>
    text.includes(bannedString.toLowerCase())
  );

  return {
    pass: found.length === 0,
    found,
    total: BANNED_TEMPLATE_STRINGS.length,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log('Template string ban list loaded.');
  console.log(`Checking for ${BANNED_TEMPLATE_STRINGS.length} banned strings.`);
}
