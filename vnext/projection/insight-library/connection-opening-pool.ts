/**
 * Authored opening-paragraph sentence pools for compat_pair connection_structure preface.
 * Keyed by compatibility class_code × connection mode × slot (hook / dynamic / frame).
 */

export type ConnectionOpeningCompatClass =
  | 'cohesive_field'
  | 'balanced_field'
  | 'high_tension_field'
  | 'transformative_field';

export type ConnectionOpeningMode = 'friendship' | 'romantic';

export type ConnectionOpeningSlot = 'hook' | 'dynamic' | 'frame';

export type ConnectionOpeningPoolEntry = {
  readonly hook: readonly string[];
  readonly dynamic: readonly string[];
  readonly frame: readonly string[];
};

export const CONNECTION_OPENING_COMPAT_CLASSES: readonly ConnectionOpeningCompatClass[] = [
  'cohesive_field',
  'balanced_field',
  'high_tension_field',
  'transformative_field',
] as const;

export const CONNECTION_OPENING_POOL: Record<
  ConnectionOpeningCompatClass,
  Record<ConnectionOpeningMode, ConnectionOpeningPoolEntry>
> = {
  cohesive_field: {
    friendship: {
      hook: [
        'Two charts that settle into each other without much negotiation.',
        'There is a structural familiarity between these two charts.',
        'This pairing has a low-friction foundation. The charts share enough patterning that the connection builds naturally.',
        'Some connections need time to calibrate. This one comes pre-tuned.',
        'The baseline here is ease. Not the shallow kind. The kind that holds up under weight.',
      ],
      dynamic: [
        'Your {seekerSun} instincts and their {targetSun} rhythms run on compatible tracks.',
        '{seekerSun} and {targetSun} share enough structural ground that the friendship builds without forcing.',
        'The {seekerElement} in your chart finds genuine traction with their {targetElement} orientation.',
        'What your {seekerSun} brings to this friendship, their {targetSun} knows how to meet.',
        'Your {seekerModality} pacing and their {targetModality} pacing find a workable tempo together.',
      ],
      frame: [
        'What follows maps where that resonance is strongest and where it gets tested.',
        'The reading below traces how that compatibility plays out planet by planet.',
        'This reading explores the texture underneath that alignment.',
        'Below, the specific planetary contacts show where this ease concentrates and what it makes possible.',
      ],
    },
    romantic: {
      hook: [
        'This pairing has genuine sustaining architecture. The charts reinforce each other in ways that compound over time.',
        'The structural coherence here is uncommon. These two charts share a deep foundation.',
        'Some relationships sustain on willpower. This one has something more durable running underneath.',
        'The resonance between these charts is not surface-level. It runs through the load-bearing structures.',
        'There is a rare kind of alignment here. Not agreement on everything. Alignment on what actually matters.',
      ],
      dynamic: [
        'Your {seekerSun} core and their {targetSun} core operate from compatible ground.',
        '{seekerSun} and {targetSun} build a shared rhythm that does not require either person to abandon their own pacing.',
        'The {seekerElement} weight in your chart meets their {targetElement} with recognition, not resistance.',
        'Your {seekerModality} nature and their {targetModality} nature create a rhythm that can sustain repetition without going stale.',
        'What your {seekerSun} needs from intimacy, their {targetSun} has the architecture to provide.',
      ],
      frame: [
        'The reading below traces where that foundation is strongest and what it makes possible.',
        'What follows maps the specific planetary contacts that give this connection its particular texture.',
        'This reading explores how that coherence plays out across the relationship\'s active channels.',
        'Below, the planet-by-planet detail shows what this architecture actually looks like in practice.',
      ],
    },
  },
  balanced_field: {
    friendship: {
      hook: [
        'This connection carries a genuine mix. Ease and challenge live in the same structure.',
        'The charts here do not lean hard in any single direction. That is rarer than it sounds.',
        'Neither pure harmony nor sustained friction defines this pairing. The field between you is genuinely mixed.',
        'This friendship has real range. The charts produce comfort in some channels and honest friction in others.',
        'A balanced relational field means neither person dominates the energetic exchange. The give and take here is structural, not performative.',
      ],
      dynamic: [
        'Your {seekerSun} and their {targetSun} create a dynamic that shifts register depending on which planets are doing the talking.',
        '{seekerSun} and {targetSun} do not mirror each other, but they do not clash at the root either. The interaction is more interesting than simple compatibility.',
        'The {seekerElement} in your chart and the {targetElement} in theirs create a conversation that changes depending on the context.',
        'Your {seekerModality} instincts and their {targetModality} instincts neither merge nor collide. They negotiate.',
        'What your {seekerSun} offers here, their {targetSun} receives selectively. That selectivity is the friendship\'s intelligence.',
      ],
      frame: [
        'What follows maps exactly where the ease concentrates and where the productive friction lives.',
        'The reading below traces how that balance distributes across the planetary contacts between you.',
        'This reading shows which channels between you run smooth and which ones generate heat.',
        'Below, the specific aspects reveal the real topology of this connection.',
      ],
    },
    romantic: {
      hook: [
        'This relationship has complexity built into its foundation. Not the dramatic kind. The kind that keeps things dimensioned.',
        'The field between these charts is genuinely mixed, and that is an asset. It means neither person gets bored.',
        'Some pairings are all resonance. Some are all friction. This one has real architecture. Both forces are present and neither one wins outright.',
        'There is nothing one-note about this connection. The charts produce warmth and challenge in roughly equal measure.',
        'A balanced field in a romantic context means the relationship has both comfort zones and growth edges built in.',
      ],
      dynamic: [
        'Your {seekerSun} and their {targetSun} create a dynamic that cannot be captured in a single adjective.',
        '{seekerSun} meeting {targetSun} produces a relationship that changes texture depending on which layer you are operating in.',
        'The {seekerElement} in your chart and the {targetElement} in theirs create genuine range. Some days that range feels like harmony. Some days it feels like a real conversation.',
        'Your {seekerModality} rhythms and their {targetModality} rhythms do not sync automatically. They find each other through repetition and intention.',
        'What your {seekerSun} needs from this relationship, their {targetSun} sometimes provides and sometimes productively challenges.',
      ],
      frame: [
        'The reading below traces where the warmth concentrates and where the growth edges are.',
        'What follows maps this balance across every active planetary channel between you.',
        'This reading explores the specific contacts that give this relationship its texture and its staying power.',
        'Below, the planetary detail shows how this complexity plays out in practice.',
      ],
    },
  },
  high_tension_field: {
    friendship: {
      hook: [
        'This connection has real friction in its architecture. Not the kind that means it is broken. The kind that means both people feel it.',
        'The charts here produce heat. That is not a warning. It is a description of the energetic reality between you.',
        'High-tension friendships are not comfortable, but they are rarely boring. This pairing has structural charge.',
        'This is a pairing that operates under pressure. The charts push against each other in ways that can be genuinely productive or genuinely exhausting, depending on how both people handle intensity.',
        'The friction here is not incidental. It is woven into the foundation.',
      ],
      dynamic: [
        'Your {seekerSun} and their {targetSun} want different things in ways that make the friendship constantly active.',
        '{seekerSun} and {targetSun} bring genuinely different operating systems to this friendship. That gap is where the energy comes from.',
        'The {seekerElement} in your chart and the {targetElement} in theirs create a cross-pressure that never fully resolves. That is the defining feature of this connection.',
        'Your {seekerModality} pacing and their {targetModality} pacing create a tempo mismatch that keeps both people adjusting.',
        'What your {seekerSun} considers settled, their {targetSun} considers open for debate. That dynamic runs through everything.',
      ],
      frame: [
        'What follows maps where that tension concentrates and what it actually produces between you.',
        'The reading below traces the specific planetary contacts that generate this charge.',
        'This reading shows where the friction is structural and where it becomes fuel.',
        'Below, the planet-by-planet contacts reveal what this tension actually looks like in practice.',
      ],
    },
    romantic: {
      hook: [
        'This relationship carries real voltage. The charts push against each other in ways that produce intensity, not indifference.',
        'High-tension pairings are the ones people remember. The charge here is structural. It does not fade with familiarity.',
        'There is nothing passive about the field between these two charts. The energy is high and the stakes feel real.',
        'This connection runs hot. That is not a judgment. It is the energetic signature of the pairing.',
        'The relational field here has persistent charge. Both people will feel it. What they do with it is the real question.',
      ],
      dynamic: [
        'Your {seekerSun} and their {targetSun} create an exchange that stays activated. Neutral is not a gear this relationship has.',
        '{seekerSun} and {targetSun} generate a dynamic that resists settling. That restlessness can be magnetic or destabilizing, and often it is both.',
        'The {seekerElement} in your chart and the {targetElement} in theirs create a sustained cross-current that defines the relationship\'s feel.',
        'Your {seekerModality} instincts and their {targetModality} instincts compete for control of the relationship\'s tempo. That competition is the engine.',
        'What your {seekerSun} wants from closeness, their {targetSun} experiences as a provocation. That tension is where the intimacy actually lives.',
      ],
      frame: [
        'What follows maps where that intensity concentrates and what it produces across the full chart.',
        'The reading below traces the specific contacts that generate this charge between you.',
        'This reading explores where the heat comes from and what it makes possible.',
        'Below, the planetary detail shows how this voltage distributes across the relationship.',
      ],
    },
  },
  transformative_field: {
    friendship: {
      hook: [
        'This is a connection that changes both people. The charts interact at a depth that goes beyond preference or personality.',
        'Transformative pairings are rare. The charts here engage each other at the level of identity, not just compatibility.',
        'Something in this pairing reaches past the surface. The structural contact between these charts operates at a depth most connections never access.',
        'This friendship has a catalytic quality. The charts do not just coexist. They activate parts of each other that would otherwise stay dormant.',
        'The relational field here is unusually deep. This is the kind of connection that rearranges priorities.',
      ],
      dynamic: [
        'Your {seekerSun} and their {targetSun} meet at a level where the interaction is not optional. Both people are changed by it.',
        '{seekerSun} and {targetSun} produce a dynamic where the contact is not casual, even when the context is.',
        'The {seekerElement} in your chart and the {targetElement} in theirs create an exchange that goes past surface compatibility into something more structural.',
        'Your {seekerModality} orientation and their {targetModality} orientation create a dynamic that neither person can fully control. That is the signature of transformative contact.',
        'What your {seekerSun} considers fixed about itself, their {targetSun} has the capacity to put in motion.',
      ],
      frame: [
        'What follows maps where that transformative contact lives and how it operates between you.',
        'The reading below traces the specific planetary channels that carry this depth.',
        'This reading explores what that catalytic quality looks like in the specific contacts between your charts.',
        'Below, the planet-by-planet detail shows where the transformation is concentrated.',
      ],
    },
    romantic: {
      hook: [
        'This relationship operates at a depth that most connections never reach. The charts engage each other at the level of identity.',
        'Transformative pairings rewrite the people inside them. The contact between these charts is not decorative. It is structural.',
        'The field between these two charts has unusual depth. This is not a relationship that leaves either person unchanged.',
        'Something in this pairing operates below the conscious level. The charts interact at depths that personality alone cannot explain.',
        'This connection has genuine transformative weight. Both people will feel it in places they did not know were accessible.',
      ],
      dynamic: [
        'Your {seekerSun} and their {targetSun} engage each other at a level where the contact changes how both people show up.',
        '{seekerSun} meeting {targetSun} here is not a surface event. The interaction reaches into the foundational layers of how both people operate.',
        'The {seekerElement} in your chart and the {targetElement} in theirs create a depth of exchange that goes past compatibility into genuine mutual transformation.',
        'Your {seekerModality} nature and their {targetModality} nature interact in ways that challenge both people to become different versions of themselves.',
        'What your {seekerSun} thought it knew about intimacy, their {targetSun} has the power to fundamentally revise.',
      ],
      frame: [
        'What follows maps where that depth concentrates and what it asks of both people.',
        'The reading below traces the planetary contacts that carry this transformative charge.',
        'This reading explores the specific channels through which that depth operates.',
        'Below, the planet-by-planet detail shows how this transformative potential distributes across the relationship.',
      ],
    },
  },
};

export function isConnectionOpeningCompatClass(code: string): code is ConnectionOpeningCompatClass {
  return (CONNECTION_OPENING_COMPAT_CLASSES as readonly string[]).includes(code);
}

export function getConnectionOpeningPool(
  compatClassCode: string,
  mode: ConnectionOpeningMode
): ConnectionOpeningPoolEntry | undefined {
  if (!isConnectionOpeningCompatClass(compatClassCode)) return undefined;
  return CONNECTION_OPENING_POOL[compatClassCode][mode];
}
