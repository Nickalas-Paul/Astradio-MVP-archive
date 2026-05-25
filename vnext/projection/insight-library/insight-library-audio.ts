/**
 * Astradio Insight Library: Audio Envelope Descriptor Insights (Batch 5)
 *
 * 17 objects covering: tempo bands (3), density bands (3), arc biases (4),
 * tension biases (3), relational textures (4).
 *
 * Keys are the exact string codes on SemanticCore.audio (AudioProjectionEnvelope).
 * No key transformation required. Pass core.audio.tempo_band directly to getAudioInsight().
 *
 * These objects replace AUDIO_LEXICON_CLAUSE_STRINGS in audio-lexicon.ts.
 * The reading_text field is the prose to weave into the reading.
 * The listen_for field is the specific listening instruction.
 *
 * Place this file at: vnext/projection/insight-library/insight-library-audio.ts
 */

import type { AudioDescriptorInsight } from './insight-library-types';

export const AUDIO_INSIGHTS: Readonly<Record<string, AudioDescriptorInsight>> = {

  // ─── TEMPO BANDS ────────────────────────────────────────────────────────────

  TEMPO_LOW: {
    id: 'TEMPO_LOW',
    category: 'tempo',
    title: 'Low tempo',
    astrological_source: `Low tempo is produced when the chart's mechanical scalars, particularly the gravity, motion, and Saturn-weighted signals, create a composition that moves at the pace of deliberate, weighted time. Saturn-dominant configurations, inward consolidation motion profiles, earth element dominance, and high-gravity charts all contribute to low tempo. The pace of the music is not slow because it is lacking energy. It is slow because the astrological signals it is translating move at the pace of genuine structural development rather than immediate reactive engagement.`,
    psychological_meaning: `The pace of this composition reflects the psychological rhythm of a chart that processes through depth rather than through speed. Just as Saturn's transits operate over years and earth element energy builds through patient accumulation, the music moves at the tempo of what genuinely endures: measured, deliberate, and fully weighted at every step. The slowness is not absence of life. It is the presence of gravity.`,
    reading_text: `The tempo of your composition today is drawn low by the weight of the signals in your chart. This is music that moves at the pace of what is actually real rather than what is immediately reactive. The measured pace is not heaviness. It is the sound of something that has earned its own ground.`,
    listen_for: `Listen for the quality of each beat arriving with full weight before the next. The music does not rush toward its destination because the destination is not the point. The development is the point, and it is happening at the pace that genuine structural change actually requires.`,
  },

  TEMPO_MED: {
    id: 'TEMPO_MED',
    category: 'tempo',
    title: 'Medium tempo',
    astrological_source: `Medium tempo is produced when the chart's mechanical scalars create a balanced relationship between Saturn's structural deliberateness and Mars or Sun energy's forward momentum. Neither weighted toward the slow and gravity-heavy end nor driven toward the rapid reactive end. Balanced tension bands, steady motion profiles, and charts without extreme dominance of either outer-planet weight or fast-moving personal planet drive tend toward medium tempo.`,
    psychological_meaning: `The pace of this composition reflects a chart that operates in the middle range of psychological time. Not the slow, patient accumulation of heavy configurations nor the fast, reactive firing of high-drive charts, but the sustainable, human pace of genuine engaged living. Medium tempo is the tempo of a person who is fully present without being either rushed or reluctant.`,
    reading_text: `The tempo of your composition sits in the middle register today, moving at a pace that is both sustainable and genuinely engaged. This is the sound of a chart that is neither hurried by urgency nor held by gravity, moving forward at the pace of something that is genuinely alive without being driven.`,
    listen_for: `Listen for the quality of forward motion without pressure. The music moves because it is going somewhere, not because something is chasing it. The pace has the quality of genuine presence rather than either urgency or restraint.`,
  },

  TEMPO_HIGH: {
    id: 'TEMPO_HIGH',
    category: 'tempo',
    title: 'High tempo',
    astrological_source: `High tempo is produced when the chart's mechanical scalars, particularly Mars, Uranus, and high-tension aspect signatures, create a composition that moves at the pace of immediate, reactive, energetically driven engagement. Mars-dominant configurations, surging or restless motion profiles, high tension bands, and charts with significant Uranian activation all contribute to high tempo. The pace of the music is not fast because it is shallow. It is fast because the astrological signals it is translating operate at the pace of immediate energetic response.`,
    psychological_meaning: `The pace of this composition reflects the psychological rhythm of a chart that engages through speed, through the immediate firing of drive and response, through the Martian quality of moving before the reflective mind has been fully consulted. High tempo is not urgency as anxiety. It is the natural pace of a configuration that processes through action rather than through contemplation.`,
    reading_text: `The tempo of your composition today runs high, driven by the fast-firing signals in your chart toward a pace that reflects genuine energetic urgency. This is music that moves at the speed of drive, of the impulse that does not wait, of the part of you that knows what it wants before it has explained itself.`,
    listen_for: `Listen for the quality of forward momentum that does not check back. The music moves because the energy behind it is real and immediate. The pace has the quality of the chart's most reactive, most alive, most directly present dimension.`,
  },

  // ─── DENSITY BANDS ──────────────────────────────────────────────────────────

  DENSITY_SPARSE: {
    id: 'DENSITY_SPARSE',
    category: 'density',
    title: 'Sparse density',
    astrological_source: `Sparse density is produced when the chart's mechanical scalars create a composition with minimal harmonic layering: few simultaneous voices, wide acoustic space between elements, and a quality of openness in the harmonic texture. Light gravity profiles, air element dominance, low tension bands, and charts with minimal stellium clustering tend toward sparse density. The space in the music is the music. The acoustic emptiness between notes is as compositionally significant as the notes themselves.`,
    psychological_meaning: `The sparse density of this composition reflects a chart that does not crowd its own space, that moves through the world without filling every available dimension with simultaneous activity. The openness in the sound is the sonic expression of a psychological configuration that leaves room: for reflection, for emergence, for what has not yet taken form. Sparse is not empty. It is the sound of genuine psychological spaciousness.`,
    reading_text: `The texture of your composition is sparse today, open, uncluttered, giving each element room to be itself without the pressure of harmonic density. The space in the music is the sound of a chart that knows what it does not need as clearly as what it does.`,
    listen_for: `Listen for what is not there as much as what is. The silence between the notes is part of the composition, the psychological spaciousness of a chart that moves with genuine lightness and leaves genuine room.`,
  },

  DENSITY_BALANCED: {
    id: 'DENSITY_BALANCED',
    category: 'density',
    title: 'Balanced density',
    astrological_source: `Balanced density is produced when the chart's mechanical scalars create a composition with a moderate, well-distributed harmonic layering. Enough simultaneous voices to feel full and alive without the pressure and compression of dense configurations. Balanced luminary weight, medium tension bands, and charts without extreme clustering or extreme dispersal tend toward balanced density. The texture has genuine richness without overwhelming the listener's capacity to hear each element.`,
    psychological_meaning: `The balanced density of this composition reflects a chart that occupies its acoustic space with appropriate fullness. Neither so sparse that the sound feels empty nor so dense that nothing can be heard distinctly. The texture mirrors a psychological configuration that can hold multiple dimensions of experience simultaneously without any single one overwhelming the others.`,
    reading_text: `The texture of your composition is balanced today, full enough to feel genuinely alive, open enough for each element to remain distinct. This is the sound of a chart that holds its complexity without being overwhelmed by it.`,
    listen_for: `Listen for the quality of multiple voices that can each be heard clearly. The harmonic richness that comes from genuine complexity that has not been compressed into density. Each layer has room to be what it is.`,
  },

  DENSITY_DENSE: {
    id: 'DENSITY_DENSE',
    category: 'density',
    title: 'Dense density',
    astrological_source: `Dense density is produced when the chart's mechanical scalars create a composition with maximum harmonic layering: many simultaneous voices, compressed acoustic space, and a quality of fullness and weight in the harmonic texture. Earth element dominance, high tension bands, Pluto-weighted configurations, stellium clusters, and anchored gravity profiles all contribute to dense density. The compression of the harmonic texture is not a compositional error. It is the accurate sonic translation of chart signals that carry significant simultaneous weight.`,
    psychological_meaning: `The dense density of this composition reflects a chart that carries multiple significant signals simultaneously, that does not simplify its own complexity into something more manageable. The harmonic fullness is the sound of a psychological configuration that holds a great deal at once, that has depth in multiple directions simultaneously, and that cannot be reduced to a single voice without losing something essential.`,
    reading_text: `The texture of your composition is dense today, full, compressed, layered with simultaneous harmonic weight. This is the sound of a chart that carries a great deal at once, that does not simplify what it holds, that has depth in multiple directions and is not apologizing for the complexity.`,
    listen_for: `Listen for the quality of multiple voices pressing against each other in a small space. The harmonic compression that comes from genuine psychological fullness. Nothing has been left out to make room, and the resulting density is the accurate sound of what your chart is actually carrying.`,
  },

  // ─── ARC BIASES ─────────────────────────────────────────────────────────────

  ARC_RISE: {
    id: 'ARC_RISE',
    category: 'arc',
    title: 'Rising arc',
    astrological_source: `The rising arc is produced when the chart's mechanical scalars create a composition that builds continuously from its opening toward a sustained peak. The overall structural movement is upward and forward, driven by signals that favor aspiration, expansion, and forward momentum. Jupiter-dominant configurations, fire element dominance, Sun-weighted luminaries, surging motion profiles, and high harmony activation all contribute to the rising arc. The music does not simply begin and continue. It begins at a lower energetic register and rises toward something genuinely larger.`,
    psychological_meaning: `The rising arc of this composition reflects a chart whose fundamental psychological orientation is toward becoming, toward what has not yet been reached, toward the Jupiterian faith that the horizon is genuinely reachable. The arc of the music is the arc of a psychology that faces forward, that grows into the space ahead of it rather than consolidating what is already present.`,
    reading_text: `The arc of your composition today is rising. The music begins from its opening note already in the process of becoming something larger. The forward momentum and the gradual increase in harmonic and energetic richness are the sound of a chart that is oriented toward what it has not yet reached.`,
    listen_for: `Listen for the quality of the music growing as you listen. The sense that each moment is slightly more than the one before it, the harmonic richness accumulating, the overall energetic register rising. The arc does not peak and drop. It rises toward something and stays there.`,
  },

  ARC_FALL: {
    id: 'ARC_FALL',
    category: 'arc',
    title: 'Falling arc',
    astrological_source: `The falling arc is produced when the chart's mechanical scalars create a composition that moves from an initial peak toward a gradual, sustained resolution or deepening. The overall structural movement is downward and inward rather than upward and forward. Saturn-dominant configurations, inward consolidation motion profiles, dark tonal polarity, water element dominance, and Pluto-weighted configurations can contribute to the falling arc. The music does not descend because it is failing. It descends because the astrological signals it translates move toward depth and interior reality rather than outward aspiration.`,
    psychological_meaning: `The falling arc of this composition reflects a chart whose fundamental orientation in this period is toward depth, toward interior reality, toward the Saturnian or Plutonian process of going below the surface rather than extending above it. The arc is the sound of a psychology that processes through descent, that finds what it needs not in expansion but in genuine depth, not in becoming more but in becoming realer.`,
    reading_text: `The arc of your composition today is descending, moving from an initial intensity toward something quieter, deeper, and more interior. The gradual settling is not diminishment. It is the sound of a chart moving toward its own depth, toward the kind of reality that only becomes accessible when the surface excitement has given way to genuine interiority.`,
    listen_for: `Listen for the quality of the music gradually releasing its own initial intensity. Not collapsing but settling, moving deliberately toward a register that is quieter and more interior than where it began. The descent is purposeful. Something real is being approached.`,
  },

  ARC_CYCLIC: {
    id: 'ARC_CYCLIC',
    category: 'arc',
    title: 'Cyclic arc',
    astrological_source: `The cyclic arc is produced when the chart's mechanical scalars create a composition that returns to its opening material. The overall structural movement is not linear progression in either direction but cyclical return. The music ends in recognizable relationship to where it began. Moon-weighted luminaries, water element dominance, the Sun-Moon opposition, and configurations with strong returning instincts all contribute to the cyclic arc. The return to the beginning is not stagnation. It is the sonic expression of the Moon's fundamental orientation toward what is familiar, of memory as the primary psychological medium.`,
    psychological_meaning: `The cyclic arc of this composition reflects a chart whose fundamental orientation is toward return, toward the Moon's instinctive wisdom that the beginning and the end of any genuine cycle are related, that what has been encountered is encountered again with new depth, that memory and recurrence are the primary forms through which meaning is made. The music ends where it began, but you are not where you were when you started.`,
    reading_text: `The arc of your composition today is cyclic. The music returns to where it began, closing the circle it opened. The return is not repetition. It is the Moon's particular form of development: encountering the familiar again after genuine experience, finding that what seemed simple has become deep.`,
    listen_for: `Listen for the moment of return, when the musical material that opened the piece comes back after genuine development. The familiar sounds different now. Something has changed in the listening even though the notes are the same. That is the cyclic arc doing exactly what the Moon's psychology does.`,
  },

  ARC_SURGE_RESOLVE: {
    id: 'ARC_SURGE_RESOLVE',
    category: 'arc',
    title: 'Surge and resolve arc',
    astrological_source: `The surge-and-resolve arc is produced when the chart's mechanical scalars create a composition built around episodes of genuine intensification followed by genuine release. The overall structural movement is not simple rising or falling or cycling but a recurring pattern of building to a peak and then fully releasing that peak before beginning again. Mars-dominant configurations, high tension bands, Moon-Mars aspects, surging motion profiles, and significant square-heavy aspect patterns all contribute to the surge-and-resolve arc.`,
    psychological_meaning: `The surge-and-resolve arc of this composition reflects a chart that processes through genuine cycles of buildup and release, the psychological equivalent of breathing on a larger scale. The music does not simply progress or simply return but builds genuine pressure and then genuinely releases it, repeatedly, because that is the energetic rhythm of the signals it is translating. Each surge is real. Each resolution is real. The arc is the sound of a psychology that lives at the boundary between pressure and release.`,
    reading_text: `The arc of your composition today surges and resolves, building genuine pressure toward peaks and then fully releasing that pressure before building again. The pattern of buildup and release is the sound of a chart that processes through intensity rather than around it, that does not manage its energy toward smooth output but allows it to build fully and release completely.`,
    listen_for: `Listen for the recurring cycle of pressure and release. The moments where the harmonic and rhythmic tension genuinely builds, and the moments where it genuinely resolves rather than simply stopping. The pattern will repeat. Each surge will find its resolution. That is the arc's promise.`,
  },

  // ─── TENSION BIASES ─────────────────────────────────────────────────────────

  AUDIO_TENSION_LOW: {
    id: 'AUDIO_TENSION_LOW',
    category: 'tension',
    title: 'Low tension',
    astrological_source: `Low audio tension is produced when the chart's mechanical scalars create a composition whose harmonic language is predominantly consonant. The aspect pattern is trine and sextile heavy, the relational field is harmonically cooperative, and the overall quality of the chart's internal dynamics is one of natural cooperation rather than creative friction. Trine-heavy aspects, cohesive field compatibility, harmony over friction relational weather, and low tension bands all contribute to low audio tension.`,
    psychological_meaning: `The low tension of this composition reflects a chart whose internal harmonic relationships are predominantly cooperative, a sound that does not ask you to hold contradictory things simultaneously but invites you into genuine harmonic ease. This is not simple or shallow music. Harmonic ease is not the same as harmonic poverty. It is the sound of signals that are working together rather than against each other, translated honestly into music.`,
    reading_text: `The harmonic tension in your composition is low today. The music resolves naturally, moves through consonant territory, and does not press you toward difficulty. The ease is not an absence of depth. It is the honest sound of a chart whose signals are in genuine cooperation in this moment.`,
    listen_for: `Listen for the quality of harmonic resolution that arrives naturally, where the dissonance, when it appears, is brief and the consonance is the primary harmonic environment. The music has genuine warmth precisely because the signals behind it are not in friction with each other.`,
  },

  AUDIO_TENSION_MED: {
    id: 'AUDIO_TENSION_MED',
    category: 'tension',
    title: 'Medium tension',
    astrological_source: `Medium audio tension is produced when the chart's mechanical scalars create a composition whose harmonic language is a productive mixture of consonance and dissonance. The aspect pattern has both harmonious and challenging elements, the chart's internal dynamics involve genuine creative friction alongside genuine cooperation. Balanced tension bands, medium friction activation, and charts with mixed aspect signatures all contribute to medium audio tension.`,
    psychological_meaning: `The medium tension of this composition reflects a chart whose internal harmonic relationships are genuinely complex, neither predominantly at ease nor predominantly at war with itself, but holding both simultaneously. The harmonic language of the music reflects the psychological reality of a configuration that carries genuine contradictions and has learned to hold them as creative material rather than simply problems to be resolved.`,
    reading_text: `The harmonic tension in your composition sits in the middle register today, present enough to give the music genuine depth and interest, not so dominant that ease is inaccessible. The productive mixture of consonance and dissonance is the honest sound of a chart that holds complexity without being undone by it.`,
    listen_for: `Listen for the music moving between harmonic ease and harmonic friction. The resolution that comes after genuine dissonance carrying more weight than resolution that was never in doubt. The tension earns the ease. The ease makes the tension bearable.`,
  },

  AUDIO_TENSION_HIGH: {
    id: 'AUDIO_TENSION_HIGH',
    category: 'tension',
    title: 'High tension',
    astrological_source: `High audio tension is produced when the chart's mechanical scalars create a composition whose harmonic language is predominantly tension-forward. The aspect pattern is square and opposition heavy, the chart's internal dynamics involve significant creative friction, and the overall quality of the chart's signals is one of productive internal conflict that generates genuine energy through that conflict. High tension bands, high friction activation, transformative field compatibility, and square-heavy aspect patterns all contribute to high audio tension.`,
    psychological_meaning: `The high tension of this composition reflects a chart whose internal harmonic relationships are predominantly friction-generating, a sound that holds genuine dissonance as its primary content, that does not resolve easily or quickly because the signals behind it are in genuine creative conflict. This music asks something of you. The tension is not a compositional error. It is the accurate translation of a chart whose most significant qualities are generated precisely by the friction between its competing signals.`,
    reading_text: `The harmonic tension in your composition is high today. The music holds significant dissonance, presses against easy resolution, and asks you to stay with what is genuinely unresolved rather than moving past it too quickly. The tension is the honest sound of a chart whose most significant qualities are generated precisely by the friction between its competing signals.`,
    listen_for: `Listen for the quality of dissonance that is held rather than quickly resolved, the harmonic tension that the music is willing to sustain because the signals behind it have not yet reached their resolution. The eventual resolution, when it arrives, will carry the full weight of everything that preceded it.`,
  },

  // ─── RELATIONAL TEXTURES ────────────────────────────────────────────────────

  REL_TEXTURE_FLUID: {
    id: 'REL_TEXTURE_FLUID',
    category: 'texture',
    title: 'Fluid texture',
    astrological_source: `The fluid relational texture is produced when the compatibility and relational weather signals between two charts create a composition where the two chart voices move in and out of harmonic relationship with the ease of water finding its own level. Their interaction is characterized by natural permeability, responsive attunement, and the dissolution of hard boundaries between the two sonic identities. High harmony activation, Neptune-Venus aspects, Moon-Venus trines, cohesive field compatibility, and emotional emphasis relational weather all contribute to the fluid texture.`,
    psychological_meaning: `The fluid texture of this composition reflects a relational field where the two charts move in and out of genuine contact naturally, where the boundary between what belongs to each person and what belongs to the shared space between them is genuinely permeable. The music of a fluid relational texture does not maintain hard distinctions between two voices but allows them to merge and separate as the relational moment requires. This is the sonic expression of emotional attunement at its most natural.`,
    reading_text: `The texture of this connection today is fluid. The two chart voices in this composition move together and apart with the ease of something that has found its own level. The quality of natural harmonic merging is the sound of a relational field where genuine contact is not effortful, where the space between these two charts allows something to flow rather than forcing it.`,
    listen_for: `Listen for the quality of the two voices finding each other. The moments of harmonic merging where the distinction between them becomes momentarily unclear, and the moments of gentle separation where each voice reasserts its own character before moving back toward the other. The fluidity itself is the relational quality being expressed.`,
  },

  REL_TEXTURE_NEUTRAL: {
    id: 'REL_TEXTURE_NEUTRAL',
    category: 'texture',
    title: 'Neutral texture',
    astrological_source: `The neutral relational texture is produced when the compatibility and relational weather signals between two charts create a composition where the two chart voices maintain clear individual identities without strong pull toward either merging or opposition. The relational field is characterized by respectful coexistence, parallel development, and the maintenance of appropriate distance rather than either intimate merging or charged friction. Balanced field compatibility, medium activation across all bands, and charts with limited cross-chart aspect activation contribute to the neutral texture.`,
    psychological_meaning: `The neutral texture of this composition reflects a relational field where two distinct chart identities coexist without strong pressure in either direction. Neither drawn powerfully toward merger nor in significant friction with each other, but occupying the same harmonic space as genuine individuals who have acknowledged each other's presence. The music of a neutral relational texture is not cold or indifferent. It is appropriately boundaried, which is its own form of relational intelligence.`,
    reading_text: `The texture of this connection today is neutral. The two chart voices in this composition maintain their individual characters, coexist in the same harmonic space, and do not press strongly toward either merging or friction. The quality of respectful individual presence is the sound of a relational field that is honoring appropriate distance.`,
    listen_for: `Listen for the quality of two voices that are aware of each other without being defined by each other. Where each maintains its own harmonic character while occupying the same musical space. The neutrality is not absence of relationship but the presence of appropriate independence.`,
  },

  REL_TEXTURE_CALL_RESPONSE: {
    id: 'REL_TEXTURE_CALL_RESPONSE',
    category: 'texture',
    title: 'Call and response texture',
    astrological_source: `The call-and-response relational texture is produced when the compatibility and relational weather signals between two charts create a composition where the two chart voices are in active, structured dialogue. One voice makes a statement and the other genuinely answers it, repeatedly, across the full length of the composition. Sun-Moon opposition, Venus-Mars opposition, cross-pressuring interaction categories, and elevated volatility relational weather all contribute to the call-and-response texture. The dialogue is the relationship. Neither voice is simply accompanying the other. Both are genuinely speaking and genuinely listening.`,
    psychological_meaning: `The call-and-response texture of this composition reflects a relational field where two charts are in genuine active dialogue, where each person's presence consistently invites and receives a genuine response from the other. This is the sonic expression of a relationship that is alive in both directions simultaneously. Both people are genuinely speaking and genuinely hearing. The interaction itself is the primary content rather than the background to something else.`,
    reading_text: `The texture of this connection today is call and response. The two chart voices in this composition are in active, structured dialogue, one speaking and the other genuinely answering, repeatedly and genuinely. The quality of mutual responsiveness is the sound of a relational field where both people are fully present to each other, where the exchange itself is the relationship.`,
    listen_for: `Listen for the quality of genuine dialogue. Where a musical statement is made and then answered, where the answer contains genuine reference to what it received, and where neither voice is simply waiting for its turn but is genuinely shaped by what it has heard from the other. The conversation is real. Both voices are changed by having listened.`,
  },

  REL_TEXTURE_STATIC: {
    id: 'REL_TEXTURE_STATIC',
    category: 'texture',
    title: 'Static texture',
    astrological_source: `The static relational texture is produced when the compatibility and relational weather signals between two charts create a composition where the relational field is characterized by stability and established pattern rather than active dialogue or fluid merging. The two chart voices maintain a consistent relationship with each other throughout the composition, neither significantly approaching nor significantly departing from their established harmonic positions. Cohesive field compatibility with low overall activation, steady motion profiles, low intensity activation, and balanced gravity profiles contribute to the static texture. Static here does not mean broken or dead. It means stable, established, and consistent.`,
    psychological_meaning: `The static relational texture of this composition reflects a relational field that is in a period of stability rather than active development. The relationship between these two charts has found its characteristic pattern and is maintaining it without significant pressure toward change in either direction. The music of a static relational texture is not stagnant. It is the sound of something that has found its form and is expressing that form honestly. This is a relationship resting in a period of genuine, grounded stability rather than active transformation.`,
    reading_text: `The texture of this connection today is static. Not frozen or broken, but stable, consistent, and maintaining its established character without significant pressure toward change. The quality of settled relational pattern is the sound of a connection that has found its form and is resting in that form rather than actively developing it in this moment.`,
    listen_for: `Listen for the quality of a relational field that knows what it is. Where the harmonic relationship between the two voices is consistent throughout, where the pattern has been established and is being maintained rather than actively negotiated. The stability itself is the content. The relationship knows its own shape.`,
  },

} as const;
