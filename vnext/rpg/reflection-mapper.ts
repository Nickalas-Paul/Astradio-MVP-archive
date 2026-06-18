import type { EphemerisSnapshot } from '../contracts';
import type { ChallengeOutcome, ChallengeScene, TransitPressure } from './types';
import type { ChoiceOption } from './types';
import { domainLabel, outcomeSentence } from './projection-language';

function shortLifeAreaLabel(lifeArea: string): string {
  switch (lifeArea) {
    case 'identity':
      return 'your sense of self and direction';
    case 'resources':
      return 'your resources, values, and material footing';
    case 'communication':
      return 'your words, interpretations, and immediate exchanges';
    case 'relationships':
      return 'your bonds and mutual commitments';
    case 'creativity':
      return 'your desire, expression, and creative risk';
    case 'work_public':
      return 'your public role, vocation, or reputation';
    case 'career_visibility':
      return 'your visible role, reputation, and external accountability';
    case 'home_foundations':
      return 'your home, roots, and foundations';
    case 'community':
      return 'your networks, alliances, and sense of belonging';
    case 'belief':
      return 'your convictions, horizon, and search for meaning';
    case 'thresholds':
      return 'shared thresholds, trust, and deeper entanglements';
    case 'health_body':
      return 'your body, energy, and daily systems';
    default:
      return 'your inner world and emotional weather';
  }
}

function responseSummary(patternTag: string): string {
  switch (patternTag) {
    case 'pause_observe':
      return 'You chose to pause and observe before moving.';
    case 'name_truth':
      return 'You chose to name the truth directly.';
    case 'seek_counsel':
      return 'You chose to involve another perspective.';
    case 'draw_boundary':
      return 'You chose to clarify a boundary.';
    case 'make_offering':
      return 'You chose to offer something of value into the situation.';
    case 'push_forward':
      return 'You chose to move forward in spite of tension.';
    case 'delay_action':
      return 'You chose to delay action on purpose.';
    case 'reframe_pattern':
      return 'You chose to reframe the pattern before acting.';
    default:
      return 'You chose a particular way to meet the pressure.';
  }
}

function symbolicMeaningFor(
  pressure: TransitPressure,
  patternTag: string
): string {
  const area = shortLifeAreaLabel(pressure.lifeArea);
  const base = `This choice is a way of working with the active pressure in ${area}.`;

  if (patternTag === 'pause_observe') {
    return `${base} It shifts the story from reacting inside the pressure to witnessing it, which often opens more grounded options.`;
  }
  if (patternTag === 'name_truth') {
    return `${base} It treats clarity and honest language as the lever here, even if the outer scene does not move on the first beat.`;
  }
  if (patternTag === 'seek_counsel') {
    return `${base} It frames connection and shared reflection as the growth path, instead of carrying the whole pattern alone.`;
  }
  if (patternTag === 'draw_boundary') {
    return `${base} It turns the transit into a lesson about capacity and edges, rather than endurance without limit.`;
  }
  if (patternTag === 'make_offering') {
    return `${base} It converts tension into a chance to participate, give, or repair in a small, concrete way.`;
  }
  if (patternTag === 'push_forward') {
    return `${base} It leans into action and momentum, asking you to notice whether forward motion clarifies the strain or feeds it.`;
  }
  if (patternTag === 'delay_action') {
    return `${base} It honors timing as part of the work, treating conscious delay as different from avoidance.`;
  }
  if (patternTag === 'reframe_pattern') {
    return `${base} It treats interpretation itself as a lever, changing the meaning of the moment before changing the outer behavior.`;
  }
  return `${base} It expresses one of the available ways to meet this pattern in real life.`;
}

function realWorldReflectionFor(
  pressure: TransitPressure,
  patternTag: string
): string {
  const area = shortLifeAreaLabel(pressure.lifeArea);
  const basePrompt = `In the next day, where does this show up around ${area}?`;

  if (patternTag === 'pause_observe') {
    return `${basePrompt} Notice one moment where you feel the pressure and simply track your body, thoughts, and environment for a few breaths.`;
  }
  if (patternTag === 'name_truth') {
    return `${basePrompt} Write or say one sentence that feels uncomfortably honest but not cruel, and notice what shifts when it is named.`;
  }
  if (patternTag === 'seek_counsel') {
    return `${basePrompt} Choose one person or resource that feels trustworthy and bring them a specific question, not just the whole swirl.`;
  }
  if (patternTag === 'draw_boundary') {
    return `${basePrompt} Identify one boundary that would protect your energy and practice stating it in simple, direct language.`;
  }
  if (patternTag === 'make_offering') {
    return `${basePrompt} Choose one concrete action, however small, that represents care or commitment, and complete it fully.`;
  }
  if (patternTag === 'push_forward') {
    return `${basePrompt} Commit to one bounded action step and then honestly assess afterward whether it moved things in a helpful direction.`;
  }
  if (patternTag === 'delay_action') {
    return `${basePrompt} Put a specific check-in time on your calendar to revisit the situation, so the delay stays conscious rather than vague.`;
  }
  if (patternTag === 'reframe_pattern') {
    return `${basePrompt} Write down the first story you are telling about the situation, then rewrite it in a way that keeps the facts but changes the posture you can take.`;
  }
  return `${basePrompt} Note what you actually do, and how that lines up with the pattern you chose in the scene.`;
}

export interface BuildOutcomeParams {
  scene: ChallengeScene;
  choice: ChoiceOption;
  natalSnapshot: EphemerisSnapshot;
  transitSnapshot: EphemerisSnapshot;
}

export function buildChallengeOutcome(params: BuildOutcomeParams): ChallengeOutcome {
  const { scene, choice, natalSnapshot, transitSnapshot } = params;
  const pressure: TransitPressure = scene.primaryPressure;
  const domain = domainLabel(pressure.domain);
  const narrative = `${responseSummary(choice.patternTag)} ${outcomeSentence(choice.outcomeDirection, pressure.domain)} Pressure stays live around ${domain}; this response shifts what strengthens first in the arc.`;

  const symbolicMeaning = symbolicMeaningFor(pressure, choice.patternTag);
  const realWorldReflection = realWorldReflectionFor(pressure, choice.patternTag);

  return {
    sceneId: scene.id,
    choiceId: choice.id,
    narrative,
    symbolicMeaning,
    realWorldReflection,
    provenance: {
      natalSnapshot: {
        ts: natalSnapshot.ts,
        tz: natalSnapshot.tz,
        lat: natalSnapshot.lat,
        lon: natalSnapshot.lon,
      },
      transitSnapshot: {
        ts: transitSnapshot.ts,
        tz: transitSnapshot.tz,
        lat: transitSnapshot.lat,
        lon: transitSnapshot.lon,
      },
      semantic_source_object_hash: undefined,
      primaryDomain: pressure.domain,
      lifeArea: pressure.lifeArea,
      pressureType: pressure.type,
      responsePatternTag: choice.patternTag,
    },
  };
}

