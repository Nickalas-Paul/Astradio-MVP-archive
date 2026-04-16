/**
 * Deterministic Campaign daily theme lead from DailyPressureState + resolved PressureEvent rows.
 * Command-Center daily narration spine: present-tense pressure truth, not natal profile projection text.
 */
import type { DailyPressureState, PressureEvent, PressureFamily, PressureInteractionType } from './phase1/contracts';
import {
  domainLabel,
  houseLanguage,
  intensityUrgency,
  polarityTone,
  stableVariant,
} from '../rpg/projection-language';

export type CampaignDailyPressureNarration = {
  readonly dailyState: DailyPressureState;
  readonly primaryEvent: PressureEvent;
  readonly supportingEvents: readonly PressureEvent[];
};

function familyWords(family: PressureFamily): string {
  return family.replace(/_/g, ' ');
}

function sortedSupporting(events: readonly PressureEvent[]): PressureEvent[] {
  return [...events].sort((a, b) => a.pressure_event_id.localeCompare(b.pressure_event_id));
}

function interactionNarration(interaction: PressureInteractionType, seed: string): string {
  if (interaction === 'none') return '';
  const pools: Record<Exclude<PressureInteractionType, 'none'>, readonly string[]> = {
    reinforcing: [
      'Multiple pressures stack and echo the same drum, so the day carries reinforcement, not a single blip.',
      'The pattern repeats across channels: the field amplifies what is already moving.',
    ],
    cross_pressuring: [
      'Two different life-areas stay loud at once, so tradeoffs show up in the open instead of staying neatly separated.',
      'Cross-pressuring means attention splits: neither thread fully yields while both stay active.',
    ],
    escalating: [
      'Pressure escalates in steps: friction meets more friction before the room cools on its own.',
      'The tempo rises because similar strains answer each other instead of canceling out.',
    ],
    dissolving: [
      'Edges soften and definitions blur: what held yesterday is harder to grip today.',
      'Dissolving pressure asks you to work with drift, not only with crisp lines.',
    ],
    transforming: [
      'Transformational pressure rewrites the stakes: the old shape of the problem no longer fits.',
      'What is live is change itself, not a stable puzzle with one missing piece.',
    ],
  };
  const lines = pools[interaction];
  return stableVariant(`${seed}|interaction|${interaction}`, [...lines]).trim();
}

function primaryLead(d: DailyPressureState, pe: PressureEvent, seed: string): string {
  const domain = domainLabel(d.primary_domain_id);
  const house = houseLanguage(d.primary_natal_house);
  const urg = intensityUrgency(d.primary_intensity_band);
  const pol = polarityTone(d.primary_pressure_polarity);
  const fam = familyWords(d.primary_pressure_family);
  const variants = [
    `Today's main pressure sits in ${domain}: ${d.primary_transit_body} meets ${d.primary_natal_body} under a ${d.primary_aspect_type} across ${house}, with ${fam} coloring the tone while conditions read ${urg} and ${pol}.`,
    `The day opens through ${domain}, where ${d.primary_transit_body} contacts ${d.primary_natal_body} by ${d.primary_aspect_type} through ${house}; the ${fam} thread stays visible with ${pol} pacing and ${urg} weight.`,
    `Lead pressure today: ${domain}, ${house}, ${d.primary_transit_body} to ${d.primary_natal_body} (${d.primary_aspect_type}), ${fam}, ${pol}, ${urg}.`,
  ];
  return stableVariant(`${seed}|primary|${pe.pressure_event_id}`, [...variants]).trim();
}

function supportingLead(ev: PressureEvent, index: number, seed: string): string {
  const domain = domainLabel(ev.domain_id);
  const house = houseLanguage(ev.natal_house);
  const fam = familyWords(ev.pressure_family);
  const urg = intensityUrgency(ev.intensity_band);
  const pol = polarityTone(ev.pressure_polarity);
  const variants = [
    `A parallel line runs through ${domain}: ${ev.transit_body} to ${ev.natal_body} (${ev.aspect_type}), ${house}, ${fam}, ${pol}, ${urg}.`,
    `Alongside that, ${domain} carries ${ev.transit_body} applying to ${ev.natal_body} by ${ev.aspect_type} through ${house}; ${fam} shows, ${pol}, ${urg}.`,
  ];
  return stableVariant(`${seed}|support|${index}|${ev.pressure_event_id}`, [...variants]).trim();
}

/**
 * Pure deterministic theme lead from daily pressure model (caller supplies seed, e.g. state chapter + daily ids).
 */
export function buildCampaignDailyThemeLead(params: {
  narration: CampaignDailyPressureNarration;
  seed: string;
}): string {
  const { narration, seed } = params;
  const { dailyState, primaryEvent, supportingEvents } = narration;
  const parts: string[] = [primaryLead(dailyState, primaryEvent, seed)];
  const sorted = sortedSupporting(supportingEvents);
  for (let i = 0; i < sorted.length; i += 1) {
    parts.push(supportingLead(sorted[i]!, i, seed));
  }
  const inter = interactionNarration(dailyState.interaction_type, seed);
  if (inter) parts.push(inter);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
