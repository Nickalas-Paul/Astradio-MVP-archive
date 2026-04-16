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

/** Optional identity slugs (natal-derived) woven into tension phrasing — no sign names, no footer sentence. */
export type ThemeLeadIdentitySlugs = {
  readonly class_slug: string;
  readonly rising_modifier_slug: string;
};

function familyWords(family: PressureFamily): string {
  return family.replace(/_/g, ' ');
}

function sortedSupporting(events: readonly PressureEvent[]): PressureEvent[] {
  return [...events].sort((a, b) => a.pressure_event_id.localeCompare(b.pressure_event_id));
}

/** Deterministic clause from slugs: shapes stakes/tempo without labels or sign names. */
function identityStakesClause(seed: string, identity: ThemeLeadIdentitySlugs | undefined): string {
  if (!identity) return '';
  const key = `${seed}|id_stk|${identity.class_slug}|${identity.rising_modifier_slug}`;
  const clauses = [
    'You feel the urge to keep the move honest rather than polished.',
    'Your timing wants one clear swing, not a scatter of half-tries.',
    'What costs you most is mis-timing the answer, not missing the drama.',
    'You read the room through what is unsaid as much as what is spoken.',
    'You tighten when the story about you starts to drift from the facts.',
    'You steady yourself by naming one true thing before the day runs away.',
  ];
  return stableVariant(key, [...clauses]).trim();
}

function primaryContactClause(d: DailyPressureState, house: string): string {
  return `${d.primary_transit_body} meets ${d.primary_natal_body} under a ${d.primary_aspect_type} across ${house}`;
}

function supportingContactClause(ev: PressureEvent, house: string): string {
  return `${ev.transit_body} to ${ev.natal_body} by a ${ev.aspect_type} through ${house}`;
}

/**
 * Grounded interaction copy from actual primary + supporting rows.
 * No "field", "channels", or abstract system-behavior narration.
 */
function interactionNarration(
  interaction: PressureInteractionType,
  d: DailyPressureState,
  primary: PressureEvent,
  supportingSorted: readonly PressureEvent[],
  seed: string,
): string {
  if (interaction === 'none') return '';
  const pDom = domainLabel(d.primary_domain_id);
  const pLine = primaryContactClause(d, houseLanguage(d.primary_natal_house));
  const s0 = supportingSorted[0];
  const s1 = supportingSorted[1];
  const s0Line = s0
    ? `${supportingContactClause(s0, houseLanguage(s0.natal_house))} in ${domainLabel(s0.domain_id)}`
    : '';
  const s1Line = s1
    ? `${supportingContactClause(s1, houseLanguage(s1.natal_house))} in ${domainLabel(s1.domain_id)}`
    : '';

  if (interaction === 'reinforcing') {
    const lines = s0Line
      ? [
          `${pLine} in ${pDom} keeps finding echoes: ${s0Line}, so the same question returns louder instead of fading.`,
          `What ${pDom} is doing stacks: ${pLine}, and ${s0Line} answers it in the same direction rather than canceling it.`,
        ]
      : [
          `${pLine} in ${pDom} keeps doubling back on itself, so the day does not give you a clean off-ramp.`,
        ];
    return stableVariant(`${seed}|interaction|reinforcing|${primary.pressure_event_id}`, [...lines]).trim();
  }

  if (interaction === 'cross_pressuring') {
    const lines =
      s0Line && s1Line
        ? [
            `${pLine} in ${pDom} runs at the same time as ${s0Line} and ${s1Line}, so one fix can feel like a slight to another thread.`,
            `You are carrying ${pLine} in ${pDom} while ${s0Line} and ${s1Line} both stay live, which splits attention before either thread rests.`,
          ]
        : s0Line
          ? [
              `${pLine} in ${pDom} does not get the room to itself because ${s0Line} stays loud in parallel.`,
              `While ${pDom} holds ${pLine}, ${s0Line} keeps asking for its own answer in the same stretch of the day.`,
            ]
          : [
              `${pLine} in ${pDom} meets more than one demand at once, so tradeoffs show up where you hoped for a single lane.`,
            ];
    return stableVariant(`${seed}|interaction|cross|${primary.pressure_event_id}`, [...lines]).trim();
  }

  if (interaction === 'escalating') {
    const lines = s0Line
      ? [
          `${pLine} in ${pDom} picks up speed because ${s0Line} answers it instead of cooling it.`,
          `Each pass through ${pDom} sharpens the last: ${pLine}, then ${s0Line}, and the tempo keeps climbing.`,
        ]
      : [
          `${pLine} in ${pDom} keeps meeting its own echo, so friction stacks until you deliberately break the loop.`,
        ];
    return stableVariant(`${seed}|interaction|escalating|${primary.pressure_event_id}`, [...lines]).trim();
  }

  if (interaction === 'dissolving') {
    const lines = [
      `${pLine} in ${pDom} blurs what felt fixed yesterday, so old edges stop holding the same weight.`,
      `What ${pDom} meant by ${pLine} yesterday is harder to grip today; definitions soften before you are ready.`,
    ];
    return stableVariant(`${seed}|interaction|dissolving|${primary.pressure_event_id}`, [...lines]).trim();
  }

  if (interaction === 'transforming') {
    const lines = s0Line
      ? [
          `${pLine} in ${pDom} is rewriting the stakes while ${s0Line} keeps moving the floor under the same story.`,
          `The shape of the problem in ${pDom} is shifting: ${pLine} and ${s0Line} both refuse the old frame.`,
        ]
      : [
          `${pLine} in ${pDom} asks for a new shape to the problem, not a tighter grip on the old one.`,
        ];
    return stableVariant(`${seed}|interaction|transforming|${primary.pressure_event_id}`, [...lines]).trim();
  }

  return '';
}

function primaryLead(
  d: DailyPressureState,
  pe: PressureEvent,
  seed: string,
  identity: ThemeLeadIdentitySlugs | undefined,
): string {
  const domain = domainLabel(d.primary_domain_id);
  const house = houseLanguage(d.primary_natal_house);
  const urg = intensityUrgency(d.primary_intensity_band);
  const pol = polarityTone(d.primary_pressure_polarity);
  const fam = familyWords(d.primary_pressure_family);
  const contact = primaryContactClause(d, house);
  const idClause = identityStakesClause(seed, identity);
  const idSuffix = idClause ? ` ${idClause}` : '';
  const variants = [
    `Right now in ${domain}, ${contact} — ${fam} shows, the moment reads ${pol} at ${urg} weight.${idSuffix}`,
    `${domain} tightens around you: ${contact}; ${fam} is visible, ${pol}, and the day stays ${urg}.${idSuffix}`,
  ];
  return stableVariant(`${seed}|primary|${pe.pressure_event_id}`, [...variants]).trim();
}

function supportingLead(
  ev: PressureEvent,
  index: number,
  seed: string,
  primaryDomainLabel: string,
): string {
  const domain = domainLabel(ev.domain_id);
  const house = houseLanguage(ev.natal_house);
  const fam = familyWords(ev.pressure_family);
  const urg = intensityUrgency(ev.intensity_band);
  const pol = polarityTone(ev.pressure_polarity);
  const contact = supportingContactClause(ev, house);
  const openerPool =
    index === 0
      ? (['At the same time,', 'This gets complicated because'] as const)
      : (['Meanwhile,', 'Also,'] as const);
  const opener = stableVariant(`${seed}|sup_op|${index}|${ev.pressure_event_id}`, [...openerPool]);
  const variants = [
    `${opener} ${contact} in ${domain} pulls sideways from what ${primaryDomainLabel} is already holding (${fam}, ${pol}, ${urg}).`,
    `${opener} ${domain} adds ${contact}, and that second thread stays ${pol} at ${urg} while ${fam} colors it.`,
  ];
  return stableVariant(`${seed}|support|${index}|${ev.pressure_event_id}`, [...variants]).trim();
}

/**
 * Pure deterministic theme lead from daily pressure model (caller supplies seed, e.g. state chapter + daily ids).
 */
export function buildCampaignDailyThemeLead(params: {
  narration: CampaignDailyPressureNarration;
  seed: string;
  themeIdentity?: ThemeLeadIdentitySlugs;
}): string {
  const { narration, seed, themeIdentity } = params;
  const { dailyState, primaryEvent, supportingEvents } = narration;
  const parts: string[] = [primaryLead(dailyState, primaryEvent, seed, themeIdentity)];
  const sorted = sortedSupporting(supportingEvents);
  const primaryDomainLabel = domainLabel(dailyState.primary_domain_id);
  for (let i = 0; i < sorted.length; i += 1) {
    parts.push(supportingLead(sorted[i]!, i, seed, primaryDomainLabel));
  }
  const inter = interactionNarration(
    dailyState.interaction_type,
    dailyState,
    primaryEvent,
    sorted,
    seed,
  );
  if (inter) parts.push(inter);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
