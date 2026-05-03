/**
 * Tier 1 synastry audit — render harness for library MEP body (compat_pair / group composition).
 *
 * Usage (after vnext:build):
 *   node dist/vnext/vnext/scripts/synastry-s5-tier1-audit-render.js SUN_MOON_CONJUNCTION
 *
 * Emits UTF-8 JSON: friendship + romantic composed paragraphs (core + behavioral + variant),
 * matching assemble-sections MEP path via composeSynastryMepAspectParagraph.
 */

import { getAspectInsight } from '../projection/insight-library/insight-library-index';
import { composeSynastryMepAspectParagraph } from '../projection/insight-library/synastry-aspect-library-render';

function main(): void {
  const aspectKey = process.argv[2]?.trim();
  if (!aspectKey) {
    console.error('Usage: node synastry-s5-tier1-audit-render.js <ASPECT_KEY>');
    process.exit(1);
  }
  const ins = getAspectInsight(aspectKey);
  if (!ins) {
    console.log(JSON.stringify({ aspect_key: aspectKey, error: 'uncovered_no_library_entry' }, null, 2));
    process.exit(0);
  }
  const payload = {
    aspect_key: aspectKey,
    friendship: { text: composeSynastryMepAspectParagraph(ins, 'friendship') },
    romantic: { text: composeSynastryMepAspectParagraph(ins, 'romantic') },
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main();
