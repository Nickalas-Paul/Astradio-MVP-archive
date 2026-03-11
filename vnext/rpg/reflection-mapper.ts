import type { EphemerisSnapshot } from '../contracts';
import type { ChallengeOutcome, ChallengeScene, TransitPressure } from './types';
import type { ChoiceOption } from './types';

function shortLifeAreaLabel(lifeArea: string): string {
  switch (lifeArea) {
    case 'identity':
      return 'your sense of self and direction';
    case 'relationships':
      return 'your bonds and mutual commitments';
    case 'work_public':
      return 'your public role, vocation, or reputation';
    case 'home_foundations':
      return 'your home, roots, and foundations';
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
    default:
      return 'You chose a particular way to meet the pressure.';
  }
}

function symbolicMeaningFor(
  pressure: TransitPressure,
  patternTag: string
): string {
  const area = shortLifeAreaLabel(pressure.lifeArea);
  const base = `This choice is a way of working with ${pressure.type} energy in ${area}.`;

  if (patternTag === 'pause_observe') {
    return `${base} It shifts the story from reacting inside the pressure to witnessing it, which often opens more grounded options.`;
  }
  if (patternTag === 'name_truth') {
    return `${base} It treats clarity and honest language as the medicine for this transit, even if nothing changes immediately.`;
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
    return `${base} It leans into action and momentum, asking you to track whether forward motion is clarifying or amplifying the strain.`;
  }
  if (patternTag === 'delay_action') {
    return `${base} It honors timing as part of the work, treating conscious delay as different from avoidance.`;
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
    return `${basePrompt} Choose one concrete action—however small—that represents care or commitment, and complete it fully.`;
  }
  if (patternTag === 'push_forward') {
    return `${basePrompt} Commit to one bounded action step and then honestly assess afterward whether it moved things in a helpful direction.`;
  }
  if (patternTag === 'delay_action') {
    return `${basePrompt} Put a specific check-in time on your calendar to revisit the situation, so the delay stays conscious rather than vague.`;
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

  const narrative = `${responseSummary(choice.patternTag)} The scene unfolds under ${pressure.type} pressure in the ${pressure.lifeArea} domain, with your response reshaping how that energy moves.`;

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
      semanticProfileEnergySignature: undefined,
      primaryDomain: pressure.domain,
      lifeArea: pressure.lifeArea,
      pressureType: pressure.type,
      responsePatternTag: choice.patternTag,
    },
  };
}

