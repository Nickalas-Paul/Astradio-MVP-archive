/**
 * Astradio Insight Library: Relational Insights (Batch 4)
 *
 * 31 objects covering:
 *   - Compatibility field classifications (4): keyed by class_code from scoring.ts
 *   - Relational weather structural themes (7): keyed by theme tag strings
 *   - Activation bands (9): keyed by ClaimId strings from CLAIM_IDS
 *   - Interaction categories (5): keyed by interaction string
 *
 * Place this file at: vnext/projection/insight-library/insight-library-relational.ts
 */

import type { RelationalInsight } from './insight-library-types';

export const RELATIONAL_INSIGHTS: Readonly<Record<string, RelationalInsight>> = {

  // ─── COMPATIBILITY FIELD CLASSIFICATIONS ────────────────────────────────────
  // Keys match class_code from classifyCompatibilityScore in vnext/compatibility/scoring.ts

  cohesive_field: {
    id: 'cohesive_field',
    category: 'compat',
    title: 'Cohesive field',
    core: `The cohesive field classification describes a pairing whose compatibility scoring produces high pairwise resonance, low friction, and strong structural coherence across the chart-to-chart interaction vectors. These two charts are built to work together. The elemental chemistry is complementary, the dominant planetary energies recognize each other, and the structural patterns of each person's chart tend to support rather than undermine the other's. This does not mean the relationship is without depth or challenge. Cohesive does not mean shallow or unchallenging. It means the fundamental architecture of the two charts is oriented in compatible directions, producing a relational field that has genuine sustaining power without requiring enormous ongoing effort to maintain its basic coherence.`,
    behavioral: `The two people's characteristic ways of being in the world are structurally compatible at a level that precedes personal chemistry or deliberate compatibility work. The resonance is real and not manufactured by mutual accommodation. What each person naturally is tends to be what the other person's chart can genuinely receive and work with. Cohesive field pairings tend to be characterized by a quality of ease that is not the same as absence of depth or conflict. Genuine differences exist and produce genuine friction. But that friction occurs within a container of fundamental compatibility rather than against a background of structural incompatibility. The relationship does not have to constantly justify its own existence to itself.`,
    friendship: `In a friendship context, cohesive field means a natural ease of ongoing companionship. Not necessarily shared interests but a compatible way of moving through the world that makes spending time together feel genuinely sustaining rather than costly.`,
    romantic: `In a romantic context, cohesive field means a pairing with genuine sustaining power. One where the structural compatibility supports the relationship through genuine difficulty because the fundamental fit is real rather than constructed.`,
    discovery: `In a discovery context, this is the finding that warrants genuine curiosity. A structural compatibility that precedes interaction and suggests that the investment of actual relationship will be well-supported by the chart-to-chart architecture.`,
    feed: `The current transit field is amplifying the structural coherence in this connection right now. What makes these two charts fundamentally compatible is more active and more visible today, and what builds in that supported space deserves full attention.`,
    sonic: `The two chart voices are in natural harmonic agreement, their sonic signatures complementary rather than conflicting. The harmonic language has a quality of mutual recognition: each voice occupies territory that supports the other, the voice leading moves naturally between them, and the overall harmonic texture has a quality of sustained, genuine warmth that does not require effort to maintain. Listen for the quality of music where two voices are clearly made for each other, where the harmonic relationship feels both natural and genuinely beautiful.`,
  },

  balanced_field: {
    id: 'balanced_field',
    category: 'compat',
    title: 'Balanced field',
    core: `The balanced field classification describes a pairing whose compatibility scoring produces a productive mixture of resonance and friction. Neither the high structural coherence of the cohesive field nor the high tension of the high tension field, but a genuinely balanced distribution of compatible and challenging elements across the chart-to-chart interaction. The two charts bring both genuine complementarity and genuine difference to the relationship. What they share provides a sustaining foundation. What they do not share provides the productive friction that keeps the relationship genuinely developmental rather than merely comfortable.`,
    behavioral: `The two people's characteristic ways of being complement each other in some domains and create genuine friction in others. The relationship has enough resonance to sustain itself through difficulty and enough friction to keep both people genuinely developing rather than simply coasting. Balanced field pairings are characterized by a quality of genuine encounter. These two people meet each other as genuinely different rather than as perfect mirrors, and the differences are productive rather than simply problematic. The relationship neither flows without effort nor requires constant management. It requires the kind of ongoing engagement that produces genuine depth.`,
    friendship: `In a friendship context, balanced field means a connection that has both genuine ease and genuine difference, a friendship where both people feel genuinely met and occasionally genuinely challenged.`,
    romantic: `In a romantic context, balanced field means a pairing with real sustaining power and real developmental edge, one where the relationship grows the people involved because it contains both genuine support and genuine friction.`,
    discovery: `In a discovery context, this is the finding that suggests a relationship worth genuine investment. Enough compatibility to sustain engagement and enough difference to make that engagement genuinely developmental.`,
    feed: `Today's transit is moving through the balanced complexity of this connection. The mixture of resonance and productive friction that characterizes this pairing is more active right now, and both dimensions are worth attending to.`,
    sonic: `Two chart voices are in genuine dialogue, complementary in some harmonic dimensions and in creative tension in others. The overall harmonic character is one of productive complexity: enough consonance to maintain a sense of shared musical ground, enough dissonance to maintain genuine harmonic interest. Listen for the quality of music where two voices are clearly in relationship, meeting each other genuinely, agreeing in some dimensions and productively disagreeing in others.`,
  },

  transformative_field: {
    id: 'transformative_field',
    category: 'compat',
    title: 'Transformative field',
    core: `The transformative field classification describes a pairing whose compatibility scoring produces high overall relational intensity, significant chart-to-chart activation across the transformation and tension vectors, and a compatibility structure oriented toward genuine mutual transformation rather than toward comfort or simple sustenance. The two charts do not simply coexist. They activate each other's deepest material. What each person brings into the relationship activates what the other person most needs to encounter and work through. This is not a comfortable classification, and presenting it as one would be a disservice. But it is not a negative one either. The most genuinely transformative relationships in a person's life often carry this classification.`,
    behavioral: `The two people's charts are configured such that each person's presence tends to activate the other's least-integrated psychological material. This is not a flaw in the relationship but its primary function: the relationship is a site of genuine psychological work. Transformative field pairings are characterized by a quality of intensity that is hard to ignore. The relationship rarely allows either person to remain at their current level of psychological development for very long. The encounter consistently pushes both people toward greater honesty, greater depth, and greater integration of what they carry. The challenge is proportional. The same intensity that makes the relationship so developmentally powerful can make it genuinely demanding to sustain.`,
    friendship: `In a friendship context, transformative field means a connection that has changed both people, a friendship that has been a site of genuine growth and genuine challenge in roughly equal measure.`,
    romantic: `In a romantic context, transformative field means a pairing where neither person will be unchanged by the encounter, a relationship of genuine depth and genuine intensity that is worth entering with full awareness of what it asks.`,
    discovery: `In a discovery context, this is the finding that warrants genuine reflection before engagement. The structural configuration suggests a relationship of real intensity that will ask something significant of both people.`,
    feed: `The current transit field is activating the transformative depth in this connection right now. Something between these two charts is pressing toward genuine change today, and what surfaces in that pressure is significant and worth meeting with honesty.`,
    sonic: `Plutonian subterranean weight combined with Uranian electric quality and Neptunian atmospheric depth, all fully active. The harmonic language is complex and dense, the tension real and sustained. The resolution, when it comes, carries the full weight of a genuinely transformative harmonic process. Listen for the quality of music that feels like it is working on you as you listen, that has a quality of genuine depth and transformative pressure.`,
  },

  high_tension_field: {
    id: 'high_tension_field',
    category: 'compat',
    title: 'High tension field',
    core: `The high tension field classification describes a pairing whose compatibility scoring produces high pairwise friction, significant cross-pressuring across multiple interaction vectors, and a chart-to-chart configuration where the structural differences between the two charts generate significant ongoing relational tension. This classification requires honest presentation. The tension is real and structural rather than situational. It is not produced by misunderstanding or bad circumstances. It is produced by the fundamental architecture of how these two charts interact. This does not mean the relationship cannot be sustained or that it lacks genuine value. High tension can be the source of genuine passion, real creative output, and significant developmental pressure. But it should be named for what it is.`,
    behavioral: `The two people's characteristic ways of being in the world tend to press against each other at multiple points simultaneously. The friction is not incidental or occasional but is a persistent feature of the relational field. High tension field pairings are characterized by a quality of recurring conflict, significant ongoing negotiation of differences, and the particular intensity that comes from two strong chart configurations that do not naturally make room for each other. The relationship requires conscious, ongoing management of the friction rather than simply enjoying what is natural. What it can produce, when both people are committed and self-aware, is genuine depth, real passion, and a quality of engagement that lower-tension pairings sometimes lack. The honest question is whether both people have the capacity and the willingness to do that work.`,
    friendship: `In a friendship context, high tension field means a connection that is rarely simple, a friendship that requires ongoing negotiation of significant differences and that can be both genuinely stimulating and genuinely exhausting.`,
    romantic: `In a romantic context, high tension field means a pairing where the structural friction is real and ongoing, a relationship that asks both people to be consistently more conscious and more committed than a lower-tension pairing would require.`,
    discovery: `In a discovery context, this is the finding that warrants genuine honesty with the user. The structural configuration suggests a relationship of real friction that will require real consciousness and real commitment to navigate productively.`,
    feed: `The current transit is pressing on the structural friction in this connection right now. The high-tension dynamics between these charts are more active and more close to the surface today than usual, and what surfaces in that friction deserves honest engagement rather than management.`,
    sonic: `The two chart voices are in structural conflict rather than structural agreement, their sonic signatures pressing against each other in ways that generate genuine musical tension. Significant dissonance, cross-pressuring between the two voices, harmonic tension that requires real development to resolve. Listen for the quality of music where two voices are clearly in real tension, where the harmonic friction is real and sustained rather than occasional.`,
  },

  // ─── RELATIONAL WEATHER STRUCTURAL THEMES ───────────────────────────────────
  // Keys match theme tag strings from themes-v1.ts

  friction_over_harmony: {
    id: 'friction_over_harmony',
    category: 'weather',
    title: 'Friction over harmony',
    core: `The friction over harmony structural theme indicates that the current relational weather between these two charts is dominated by tense and cross-pressuring aspect hits rather than supportive and flowing ones. The live transit field is activating the friction vectors of the relationship more than the harmony vectors in this moment. This is a weather condition, not a permanent state. It describes what is happening now, not what the relationship fundamentally is. The friction that the current sky is generating between these charts is real and present. But it will pass as the transit field moves.`,
    behavioral: `The two people's differences are more visible and more pressing than their resonances right now. The aspects of the relationship that require negotiation and conscious management are being activated by the current sky while the aspects that flow naturally are temporarily quieter. Interactions between these two people may carry more friction than usual. Differences feel sharper. The productive use of this weather is to engage the friction honestly rather than avoiding it. The current sky is providing an opportunity to work with what is genuinely difficult rather than a reason to panic about the relationship's fundamental health.`,
    feed: `The current transit field is generating more friction than harmony in this connection today. The differences between these charts are more active than the resonances right now, and engaging that friction honestly is more productive than waiting for it to pass.`,
    sonic: `Martian rhythmic pressure, Saturnian structural weight, and Plutonian subterranean density are more present than Venusian warmth and Jupiterian generosity in this weather. The harmonic language has more dissonance than usual for this pairing, more friction between the two chart voices. Listen for the quality of music where something is clearly being worked through, where the harmonic friction is the primary content and the resolution has not yet arrived.`,
  },

  harmony_over_friction: {
    id: 'harmony_over_friction',
    category: 'weather',
    title: 'Harmony over friction',
    core: `The harmony over friction structural theme indicates that the current relational weather between these two charts is dominated by supportive and flowing aspect hits rather than tense and cross-pressuring ones. The live transit field is activating the harmony vectors of the relationship more than the friction vectors in this moment. The natural resonances between these charts are what the current sky is amplifying.`,
    behavioral: `The aspects of the relationship that flow most easily between these two people are the ones that are most active right now. Interactions carry more ease than usual. The fundamental compatibility of the pairing is more available. The relational quality that exists between these charts at their best is more accessible than it typically is. This weather is a gift, and the productive use of it is not simply to enjoy it but to use the ease to address what is genuinely difficult, because the container is more supportive than usual.`,
    feed: `The current transit field is amplifying the harmony between these charts today. The resonances that run between these two people are more active than the friction right now, and what becomes possible in that supported space is worth building on.`,
    sonic: `Venusian warmth, Jupiterian generosity, and the Sun and Moon's cooperative frequencies are more present than the friction-generating Martian and Saturnian qualities. The harmonic language has more consonance and natural resolution than usual for this pairing. Listen for the quality of music where something flows, where the harmonic ease is the primary content and the relationship between the two chart voices sounds genuinely supported.`,
  },

  elevated_volatility: {
    id: 'elevated_volatility',
    category: 'weather',
    title: 'Elevated volatility',
    core: `The elevated volatility structural theme indicates that the current relational weather between these two charts is characterized by high activation across multiple aspect types simultaneously. The live transit field is generating significant energetic activation in both the harmony and friction vectors, producing a weather condition of genuine intensity and unpredictability. The relationship is not necessarily more difficult right now than usual. It is more alive, more active, and more variable. The energy between these charts is higher than its baseline and is moving more rapidly between its poles.`,
    behavioral: `The emotional and energetic charge between the two people is higher than its typical baseline. Interactions carry more weight than usual in both directions, and the relational field is more responsive to small inputs than it normally is. A moment of warmth is warmer than usual. A moment of friction is sharper than usual. The productive use of elevated volatility weather is to be conscious of the heightened charge rather than unconscious of it, to know that the amplification is a weather condition and not a permanent change in the relationship's fundamental character.`,
    feed: `The current transit field is generating elevated volatility in this connection right now. The energy between these charts is running higher than its baseline today, and both the warmth and the friction are more present than usual. Staying conscious of the amplification is the move.`,
    sonic: `Uranian electric quality combined with Mars's driving force and the Moon's emotional reactivity, all running higher than baseline. The harmonic language is more intense than usual, the rhythmic quality more activated, the dynamic range wider. Listen for the quality of music that is clearly running at a higher energetic level than baseline, where everything is slightly more present, more charged, more alive than usual.`,
  },

  elevated_growth_pressure: {
    id: 'elevated_growth_pressure',
    category: 'weather',
    title: 'Elevated growth pressure',
    core: `The elevated growth pressure structural theme indicates that the current relational weather between these two charts is characterized by significant activation in the transformation and development vectors. The live transit field is generating pressure that is specifically oriented toward growth and change within the relationship rather than toward either simple harmony or simple friction. The pressure is developmental in character. It is asking something of both people in this connection, inviting or compelling movement toward a more developed version of the relationship and of the individuals within it.`,
    behavioral: `The current sky is not allowing this relationship to remain at its current level of development. Something is pressing toward greater honesty, greater depth, greater integration of what has not yet been fully worked through. Both people may feel a quality of relational restlessness, a sense that something needs to shift, that the current configuration is not quite adequate, and that the relationship is pressing toward its next form. The productive use of elevated growth pressure weather is to engage the developmental demand consciously rather than resisting it or being blindly driven by it.`,
    feed: `The current transit field is generating growth pressure in this connection right now. Something about this relationship is being pressed toward its next form today, and what that pressure is asking of both people is worth engaging consciously rather than waiting for it to pass.`,
    sonic: `Jupiterian expansive drive combined with Saturnian structural demand: the music is reaching toward something larger while also being pressed by something structurally significant. The harmonic language has a quality of developmental tension, reaching beyond the current harmonic territory while also being tested for structural soundness. Listen for the quality of music that feels like it is growing toward something, that has both the forward reach of expansion and the weight of genuine structural demand simultaneously.`,
  },

  emotional_emphasis: {
    id: 'emotional_emphasis',
    category: 'weather',
    title: 'Emotional emphasis',
    core: `The emotional emphasis structural theme indicates that the current relational weather between these two charts is dominated by lunar and water-sign activations. The live transit field is primarily activating the emotional and instinctive dimensions of the relationship rather than the intellectual, assertive, or structural dimensions. The current sky is highlighting the feeling dimension of this connection. What is felt between these two people is what is most alive and most present in this weather.`,
    behavioral: `The emotional register of the relationship is more present than usual. Feelings that are ordinarily background material become foreground content. The instinctive and empathic dimensions of the connection are more accessible. The intellectual or practical dimensions of the relationship are temporarily less available as the primary relational medium. Emotional intelligence is the most relevant skill in this weather. What is felt is more important than what is thought, and the relational quality that the current sky amplifies is genuine emotional attunement rather than practical problem-solving.`,
    feed: `The current transit field is emphasizing the emotional dimension of this connection today. What is felt between these charts is more present than what is thought or decided, and the feeling register of this relationship is the primary content right now.`,
    sonic: `Lunar and Neptunian sonic qualities dominate: modal harmonic depth, breathing rhythmic quality, melodic lines that cycle back toward the familiar, atmospheric harmonic ambiguity. The current weather is amplifying the feeling dimension of the chart voices' relationship. Listen for the quality of music where the emotional content is the primary voice, where the feeling register is more present than the structural or intellectual register.`,
  },

  communication_emphasis: {
    id: 'communication_emphasis',
    category: 'weather',
    title: 'Communication emphasis',
    core: `The communication emphasis structural theme indicates that the current relational weather between these two charts is dominated by Mercurial and air-sign activations. The live transit field is primarily activating the intellectual, communicative, and informational dimensions of the relationship. The current sky is highlighting the thinking and speaking dimension of this connection. What is said, understood, and intellectually exchanged between these two people is what is most alive in this weather.`,
    behavioral: `The intellectual and communicative dimensions of the relationship are more present than usual. Ideas, conversations, and the exchange of information and perspective are the primary medium of relational contact in this period. Genuine conversation is the most productive relational activity right now. What these two people think about and say to each other is more important than what they feel or what they build together. This is weather for saying the things that are usually left as understood.`,
    feed: `The current transit field is emphasizing the communicative dimension of this connection today. What is thought, said, and intellectually exchanged between these charts is the primary relational content right now, and genuine conversation is the most productive use of this weather.`,
    sonic: `Mercurial sonic qualities dominate: quick, syncopated rhythm, alert harmonic movement through many tonal areas, melodic lines that make unexpected connections. The intellectual, connective dimension of the two chart voices' relationship is what the current weather amplifies. Listen for the quality of music where the intellectual alertness is the primary voice, where the quick, connective quality of Mercury is more present than the emotional depth of the Moon or the structural weight of Saturn.`,
  },

  outer_to_personal: {
    id: 'outer_to_personal',
    category: 'weather',
    title: 'Outer to personal',
    core: `The outer to personal structural theme indicates that the current relational weather between these two charts is characterized by significant activation of personal planets in both charts by the outer transpersonal planets in the current transit field. Uranus, Neptune, or Pluto are making significant aspects to the personal planets of both people simultaneously. The current sky is bringing the full weight of transpersonal archetypal force to bear on the personal dimensions of this relationship. This is significant weather. It means both people are simultaneously being pressed by forces that operate at a depth and scale that exceeds ordinary personal psychology.`,
    behavioral: `Both people are simultaneously experiencing the kind of profound archetypal activation that outer planet transits to personal planets produce. The relationship is carrying more than its ordinary personal weight. Collective archetypal forces are moving through both people simultaneously, activating depth material, pressing toward transformation or awakening or dissolution in ways that exceed what either person would choose if they were simply managing their own lives. The productive use of this weather is to understand what is happening rather than simply to manage its symptoms.`,
    feed: `The current sky is bringing transpersonal force to bear on the personal dimensions of this connection right now. Something larger than ordinary personal dynamics is moving through both charts simultaneously today, and what that force is activating in this relationship is genuinely significant.`,
    sonic: `The transpersonal sonic qualities, Uranian electric disruption, Neptunian atmospheric dissolution, or Plutonian subterranean transformation, are bearing down on the personal planet voices of both charts simultaneously. The harmonic language has an unusual quality of depth and magnitude. Something is happening at a larger scale than ordinary relational weather. Listen for the quality of music where something vast is pressing on something personal, where the transpersonal harmonic forces are bearing down on the personal melodic voices.`,
  },

  // ─── ACTIVATION BANDS ───────────────────────────────────────────────────────
  // Keys match ClaimId strings from CLAIM_IDS in vnext/semantic/ontology-codes.ts

  REL_HARMONY_HIGH: {
    id: 'REL_HARMONY_HIGH',
    category: 'activation',
    title: 'High harmony activation',
    core: `The high harmony activation band indicates that the current relational weather scoring places the harmony vector of this connection significantly above its baseline. The live transit field is generating more supportive, flowing, resonant aspect activation between these two charts than their baseline relationship typically carries. The current moment is one of genuine relational ease and mutual support. The fundamental compatibility of the two charts is being actively amplified by what is happening in the sky right now.`,
    behavioral: `The frictions that are part of any relationship are quieter than usual and the resonances are louder. Interactions carry more warmth and natural flow than the baseline. Decisions and communications that require goodwill and openness from both people are more likely to go well in this window than in lower harmony activation periods.`,
    feed: `The current sky is generating high harmony activation in this connection. The warmth and natural resonance between these charts is running significantly above baseline right now, and this is a genuine window for the kind of connection and communication that benefits from goodwill.`,
    sonic: `The consonant, flowing aspects between the two chart voices are the active harmonic forces: warmth, ease, and natural resolution as the primary qualities. The harmonic language is more beautiful than the baseline, the voice leading smoother, the overall quality more sustaining. Listen for the quality of music where the relational ease is the primary voice.`,
  },

  REL_HARMONY_MED: {
    id: 'REL_HARMONY_MED',
    category: 'activation',
    title: 'Medium harmony activation',
    core: `The medium harmony activation band indicates that the current relational weather scoring places the harmony vector of this connection at or near its baseline. The live transit field is generating a typical level of supportive and flowing aspect activation between these two charts. Neither significantly elevated nor significantly depressed, the harmony dimension of this connection is running at its characteristic level.`,
    behavioral: `Neither particularly supported nor particularly under pressure in the harmony dimension. The connection feels like itself.`,
    feed: `The current sky is holding the harmony between these charts at its typical level. The connection feels like itself today, and what is characteristic of this pairing is what is most available right now.`,
    sonic: `The characteristic harmonic quality of this pairing at its baseline: neither more beautiful nor more tense than usual. The two chart voices are in their typical relationship.`,
  },

  REL_HARMONY_LOW: {
    id: 'REL_HARMONY_LOW',
    category: 'activation',
    title: 'Low harmony activation',
    core: `The low harmony activation band indicates that the current relational weather scoring places the harmony vector of this connection below its baseline. The live transit field is generating less supportive and flowing aspect activation than this pairing typically carries. The natural resonances between these charts are quieter than usual in this moment. This is a temporary weather condition rather than a permanent shift.`,
    behavioral: `The ease that normally characterizes this connection is less available. The friction is relatively more present and the warmth relatively less. Interactions may require more conscious effort to maintain the relational quality that flows more naturally in higher harmony periods.`,
    feed: `The current sky is generating lower harmony activation than usual in this connection today. The natural ease between these charts is quieter right now, and interactions may require more conscious care than they usually do.`,
    sonic: `The consonant, flowing aspects are quieter than the baseline. The overall harmonic quality is slightly more complex and requires more work to sustain.`,
  },

  REL_FRICTION_HIGH: {
    id: 'REL_FRICTION_HIGH',
    category: 'activation',
    title: 'High friction activation',
    core: `The high friction activation band indicates that the current relational weather scoring places the friction vector of this connection significantly above its baseline. The live transit field is generating more tense and cross-pressuring aspect activation between these two charts than their baseline relationship typically carries. The aspects of this connection that require conscious management are being actively amplified by what is happening in the sky right now.`,
    behavioral: `The friction that is part of this pairing is louder than usual and the ease is quieter. Interactions may carry more charge than the baseline, differences feel sharper, and conscious management of the relational dynamic is more important than in lower friction periods. This is not a sign that the relationship is failing. It is a weather condition that requires appropriate awareness.`,
    feed: `The current sky is generating high friction activation in this connection right now. The tension and cross-pressuring between these charts is running above baseline today, and engaging that friction consciously is more productive than either avoiding it or being blindly driven by it.`,
    sonic: `The tense, cross-pressuring aspects between the two chart voices are the active harmonic forces: more dissonance than the baseline, more harmonic friction, more requirement for conscious development before resolution. Listen for the quality of music where the relational friction is the primary voice.`,
  },

  REL_FRICTION_MED: {
    id: 'REL_FRICTION_MED',
    category: 'activation',
    title: 'Medium friction activation',
    core: `The medium friction activation band indicates that the current relational weather scoring places the friction vector of this connection at or near its baseline. The live transit field is generating a typical level of tense and cross-pressuring aspect activation. The friction dimension of this connection is running at its characteristic level.`,
    behavioral: `The tension that is part of this relationship is neither amplified nor suppressed. The connection feels like itself.`,
    feed: `The current sky is holding the friction between these charts at its typical level. The tension in this connection is neither elevated nor suppressed right now.`,
    sonic: `The characteristic harmonic complexity of this pairing at its baseline: the level of harmonic tension that is normal for these two chart voices.`,
  },

  REL_FRICTION_LOW: {
    id: 'REL_FRICTION_LOW',
    category: 'activation',
    title: 'Low friction activation',
    core: `The low friction activation band indicates that the current relational weather scoring places the friction vector of this connection below its baseline. The live transit field is generating less tense and cross-pressuring aspect activation than this pairing typically carries. The friction that is normally part of this relationship is quieter than usual in this moment. This is generally a welcome weather condition. The aspects that require management are less insistent, and what flows naturally has more room.`,
    behavioral: `The friction that normally characterizes this connection is less present. Interactions carry less charge than baseline, the differences that usually require management are quieter, and the relational field has more room for the warmth and ease that normally exists alongside the friction.`,
    feed: `The current sky is generating lower friction than usual in this connection today. The tension between these charts is quieter than its baseline, and the relational field has more room for ease than it typically does.`,
    sonic: `The dissonant, cross-pressuring aspects are quieter than the baseline. The overall harmonic character is slightly more resolved and consonant than usual for this pairing.`,
  },

  REL_INTENSITY_HIGH: {
    id: 'REL_INTENSITY_HIGH',
    category: 'activation',
    title: 'High intensity activation',
    core: `The high intensity activation band indicates that the current relational weather scoring places the overall intensity vector of this connection significantly above its baseline. The live transit field is generating high overall activation across multiple aspect types simultaneously. The relationship is running hot in this moment, more alive, more charged, and more present than its typical baseline in both directions.`,
    behavioral: `The relationship is more fully activated than usual. Interactions carry more weight, more charge, and more significance than the baseline. Both the warmth and the friction, both the resonance and the difference, are more present than usual. The relational field is more responsive to inputs, which means both positive and challenging interactions land with more force than they would in lower intensity periods.`,
    feed: `The current sky is generating high intensity activation in this connection right now. Both charts are running above baseline, and what happens between these two people today carries more weight than it would in an ordinary period. Consciousness of the amplification is the most useful thing.`,
    sonic: `Both the warmth and the friction, both the resonance and the tension, are running above their baseline levels simultaneously. The overall sonic character is more intense, more alive, and more present than the baseline of this pairing.`,
  },

  REL_INTENSITY_MED: {
    id: 'REL_INTENSITY_MED',
    category: 'activation',
    title: 'Medium intensity activation',
    core: `The medium intensity activation band indicates that the current relational weather scoring places the overall intensity vector of this connection at or near its baseline. The live transit field is generating a typical level of overall activation. The relationship is running at its characteristic level of aliveness and charge.`,
    behavioral: `Neither particularly amplified nor particularly quiet. The connection feels like itself.`,
    feed: `The current sky is holding this connection at its typical intensity level. What is characteristic of this pairing is what is most available today.`,
    sonic: `The characteristic energetic quality of this pairing at its baseline: neither more alive nor more quiet than usual.`,
  },

  REL_INTENSITY_LOW: {
    id: 'REL_INTENSITY_LOW',
    category: 'activation',
    title: 'Low intensity activation',
    core: `The low intensity activation band indicates that the current relational weather scoring places the overall intensity vector of this connection below its baseline. The live transit field is generating less overall activation than this pairing typically carries. The relationship is quieter than usual in this moment, less charged, less present, operating closer to the background of each person's awareness than it typically does.`,
    behavioral: `The relationship is less fully activated than usual. Interactions carry less charge, the relational field is less responsive to inputs, and both the warmth and the friction are quieter than baseline. This can be a welcome rest period in high-intensity pairings, or a period of productive quiet in which less urgent relational material can be attended to.`,
    feed: `The current sky is generating lower overall intensity than usual in this connection today. The relational field is quieter than its baseline, and what is present between these charts right now is understated rather than charged.`,
    sonic: `Both the warmth and the friction are running below their baseline levels. The overall sonic character is more understated than the characteristic sound of this pairing.`,
  },

  // ─── INTERACTION CATEGORIES ─────────────────────────────────────────────────

  reinforcing: {
    id: 'reinforcing',
    category: 'interaction',
    title: 'Reinforcing',
    core: `The reinforcing interaction category describes a chart-to-chart dynamic where the two people's dominant planetary energies and psychological orientations are pointed in similar enough directions that they consistently amplify and support each other's characteristic patterns. Reinforcing dynamics are not simple agreement. They are structural amplification. What each person most characteristically is tends to make the other person more fully what they most characteristically are. The effect is compounding: this pairing makes both people more themselves.`,
    behavioral: `The two people's core psychological structures are oriented in compatible enough directions that the presence of each tends to strengthen rather than challenge or complement the other. The result is genuine shared momentum. The relationship tends to move in a clear direction because both people's energies are reinforcing rather than balancing each other. The gift is coherence and shared direction. The developmental shadow is the echo chamber quality that pure reinforcing dynamics can produce when no complementary or challenging element is present to provide perspective.`,
    feed: `The current transit is activating the reinforcing dynamic in this connection. What each person characteristically is is being amplified by the other right now, and the shared direction that produces is more visible and more active today.`,
    sonic: `The two chart voices are moving in the same harmonic direction, amplifying each other's characteristic sonic qualities rather than providing complementary contrast. The harmonic language has a quality of compounding in one direction, the two voices building together toward the same destination.`,
  },

  cross_pressuring: {
    id: 'cross_pressuring',
    category: 'interaction',
    title: 'Cross-pressuring',
    core: `The cross-pressuring interaction category describes a chart-to-chart dynamic where the two people's dominant planetary energies are oriented in sufficiently different directions that they consistently press against each other's characteristic patterns. Not in the destructive sense of high tension field, but in the productive sense of genuine complementarity under pressure. Cross-pressuring dynamics are the source of genuine growth in relationships: each person's presence consistently invites the other toward territory they would not naturally occupy on their own.`,
    behavioral: `The two people's core psychological structures are oriented differently enough that the presence of each tends to press the other toward greater range and integration. The result is a pairing with genuine developmental edge. The relationship tends to make both people more complete rather than simply more themselves. The gift is growth and complementarity. The challenge is the ongoing friction that cross-pressuring dynamics require both people to navigate consciously.`,
    feed: `The current transit is activating the cross-pressuring dynamic in this connection. The complementary pressure that each person's chart exerts on the other's characteristic patterns is more active right now, and what that pressure is inviting both people toward is worth paying attention to.`,
    sonic: `The two chart voices are in productive harmonic dialogue across their differences, each pressing the other toward harmonic territory it would not naturally occupy. The overall result is a richer harmonic range than either voice alone would produce.`,
  },

  escalating: {
    id: 'escalating',
    category: 'interaction',
    title: 'Escalating',
    core: `The escalating interaction category describes a chart-to-chart dynamic where the two people's energies tend to amplify each other in ways that build toward intensity. The relational field has a quality of escalation built into its structure. Each person's response tends to activate a stronger response from the other, producing dynamics that can escalate in either direction: toward genuine passion and intensity when the energy is positive, or toward genuine conflict when the energy is tense.`,
    behavioral: `The two people's energetic signatures interact in ways that compound rather than stabilize. Things tend to be more intense than they began: positive moments can escalate toward genuine exhilaration and negative moments can escalate toward genuine conflict more readily than in non-escalating dynamics. Conscious awareness of the escalation pattern is the primary skill this interaction category requires.`,
    feed: `The current transit is activating the escalating dynamic in this connection right now. The tendency for things to build in intensity between these charts is more active today, and what is happening between these people is likely to run hotter than usual in whatever direction it goes.`,
    sonic: `The composition has a built-in tendency toward increasing intensity. The harmonic language builds as it develops, the dynamic range expands rather than stabilizes, the two chart voices pushing each other toward greater intensity in whichever harmonic direction they are moving.`,
  },

  dissolving: {
    id: 'dissolving',
    category: 'interaction',
    title: 'Dissolving',
    core: `The dissolving interaction category describes a chart-to-chart dynamic where the two people's energies tend to soften each other's edges. The relational field has a quality of boundary dissolution built into its structure. Each person's presence tends to make the other's characteristic patterns less rigidly maintained, more fluid, more permeable. This can be a deeply nourishing quality when it produces genuine openness and vulnerability. It can be genuinely challenging when it produces a loss of individual definition.`,
    behavioral: `The two people's energetic signatures interact in ways that soften rather than sharpen, that produce permeability rather than definition. Both people may find it easier to be vulnerable and open with each other and harder to maintain the kind of clear individual definition that each requires outside the relationship.`,
    feed: `Today's transit is activating the dissolving quality of this connection. The boundaries between these two charts are more permeable than usual right now, and what flows between them in that increased openness is worth receiving with both openness and awareness.`,
    sonic: `The two chart voices tend to blur into each other. Harmonic boundaries between them become more permeable, the distinct sonic signatures becoming less sharply defined and more atmospherically merged. Neptunian harmonic qualities are more present than usual between these two voices.`,
  },

  transforming: {
    id: 'transforming',
    category: 'interaction',
    title: 'Transforming',
    core: `The transforming interaction category describes a chart-to-chart dynamic where the two people's energies tend to catalyze genuine change in each other. The relational field has a quality of mutual transformation built into its structure. Encounters between these two charts consistently seem to leave both people at least slightly different from how they arrived. The relationship does not simply sustain. It develops and transforms.`,
    behavioral: `The two people's energetic signatures interact in ways that activate depth material and catalyze genuine psychological movement. Neither person can simply coast in the other's presence. Something about the interaction consistently presses toward greater honesty, greater depth, or greater integration of what has not yet been worked through.`,
    feed: `The current transit is activating the transforming quality of this connection. The catalytic, depth-activating dynamic between these charts is more present today, and what the encounter between these two people generates right now is likely to leave something genuinely different.`,
    sonic: `The two chart voices consistently move each other toward new harmonic territory. The encounter between them does not leave the harmonic language where it began. Plutonian depth and genuine harmonic transformation are more present between these two voices than in non-transforming interaction categories.`,
  },

} as const;
