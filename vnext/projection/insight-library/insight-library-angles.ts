/**
 * Angle placements — Ascendant (and future MC/IC).
 * Keys: PLCMT_ASCENDANT_{SIGN}
 * Sign-only framing (angles are house cusps; no house subsection in Identity UI).
 */

import type { PlanetInSignInsight } from './insight-library-types';

export const ASCENDANT_PLACEMENTS: Readonly<Record<string, PlanetInSignInsight>> = {
  PLCMT_ASCENDANT_ARIES: {
    key: 'PLCMT_ASCENDANT_ARIES',
    planet: 'ASCENDANT',
    sign: 'ARIES',
    title: 'Ascendant in Aries',
    core: `Your Ascendant in Aries means you present with immediate directness, forward momentum, and the energy of someone who acts first and reflects later. People experience you as pioneering, courageous, and refreshingly unfiltered in your approach to new situations.`,
    behavioral: `You enter rooms with visible purpose, make quick decisions without waiting for group consensus, and naturally take initiative when situations require action. Your physical presence carries the quality of readiness—you look like someone who's about to do something rather than someone who's waiting for permission.`,
    friendship: `In friendship, your Aries rising shows up as the friend who suggests the plan, speaks first, and keeps the bond moving. Others read your directness as enthusiasm rather than aggression when the connection is honest.`,
    romantic: `In romance, your Aries rising brings immediate chemistry and unmistakable pursuit energy. Partners feel chosen quickly and clearly; the opening movement of the relationship often sets its pace.`,
    feed: `Your rising sign carries Aries energy today. First impressions run hot, direct, and ready to initiate.`,
    sonic: `Your Aries Ascendant contributes sharp melodic attacks, bright harmonic energy, and rhythm that initiates without hesitation—the sound of immediate presence and forward drive.`,
  },

  PLCMT_ASCENDANT_TAURUS: {
    key: 'PLCMT_ASCENDANT_TAURUS',
    planet: 'ASCENDANT',
    sign: 'TAURUS',
    title: 'Ascendant in Taurus',
    core: `Your Ascendant in Taurus means you present with grounded steadiness, physical presence, and the energy of someone who can't be rushed. People experience you as calm, reliable, and possessing a natural authority that comes from being fully embodied.`,
    behavioral: `You move through space deliberately, respond to questions after taking a moment to consider, and carry yourself with the quality of someone who knows their own weight. Your physical presence communicates 'I'm here, and I'm not going anywhere until I'm ready.'`,
    friendship: `In friendship, your Taurus rising offers steady presence, tangible comfort, and patience with pacing. Friends experience you as someone who shows up consistently rather than dramatically.`,
    romantic: `In romance, your Taurus rising signals sensual calm and durability in first contact. Attraction builds through reliability and physical ease as much as through words.`,
    feed: `Your rising sign carries Taurus energy today. Presence reads grounded, patient, and physically reassuring.`,
    sonic: `Your Taurus Ascendant contributes rich sustained tones, warm harmonic grounding, and rhythm that is patient and unhurried—the sound of physical presence and embodied certainty.`,
  },

  PLCMT_ASCENDANT_GEMINI: {
    key: 'PLCMT_ASCENDANT_GEMINI',
    planet: 'ASCENDANT',
    sign: 'GEMINI',
    title: 'Ascendant in Gemini',
    core: `Your Ascendant in Gemini means you present with quick adaptability, intellectual curiosity, and the energy of someone who's always ready for the next conversation. People experience you as clever, sociable, and perpetually interested in learning what you don't already know.`,
    behavioral: `You engage new situations through questions and observation, shift your presentation to match the context you're in, and naturally create connection through wit and verbal agility. Your physical presence is light and mobile—you look like someone who could pivot to something completely different at any moment.`,
    friendship: `In friendship, your Gemini rising sparks conversation, introduces ideas, and keeps social contact lively. Friends experience you as curious, witty, and easy to talk with on short notice.`,
    romantic: `In romance, your Gemini rising opens doors through words, humor, and mental rapport. Initial attraction often starts as fascination before it deepens.`,
    feed: `Your rising sign carries Gemini energy today. First contact favors conversation, curiosity, and quick mental exchange.`,
    sonic: `Your Gemini Ascendant contributes nimble melodic movement, airy harmonic textures, and rhythm that is conversational and quick—the sound of mental agility and adaptive presence.`,
  },

  PLCMT_ASCENDANT_CANCER: {
    key: 'PLCMT_ASCENDANT_CANCER',
    planet: 'ASCENDANT',
    sign: 'CANCER',
    title: 'Ascendant in Cancer',
    core: `Your Ascendant in Cancer means you present with emotional receptivity, protective instinct, and the energy of someone who feels their way into situations before committing. People experience you as nurturing, intuitive, and possessing a natural ability to make others feel safe.`,
    behavioral: `You approach new situations cautiously, read the emotional temperature of rooms before speaking, and instinctively create comfort for others even when you're personally uncertain. Your physical presence communicates 'I'm here to hold space, not to dominate it.'`,
    friendship: `In friendship, your Cancer rising offers warmth, attunement, and protective care. Friends feel met emotionally before they feel evaluated.`,
    romantic: `In romance, your Cancer rising signals tenderness and emotional safety in first meetings. Partners sense that vulnerability could be welcome here.`,
    feed: `Your rising sign carries Cancer energy today. Presence reads receptive, protective, and emotionally attuned.`,
    sonic: `Your Cancer Ascendant contributes flowing melodic waves, warm harmonic shelter, and rhythm that ebbs and flows with emotional tides—the sound of receptive presence and protective care.`,
  },

  PLCMT_ASCENDANT_LEO: {
    key: 'PLCMT_ASCENDANT_LEO',
    planet: 'ASCENDANT',
    sign: 'LEO',
    title: 'Ascendant in Leo',
    core: `Your Ascendant in Leo means you present with natural radiance, generous warmth, and the energy of someone who expects to be noticed. People experience you as confident, dignified, and carrying yourself as though you have every right to take up space.`,
    behavioral: `You enter situations with visible self-assurance, speak and move as though performing for an audience (even when alone), and naturally draw attention through sheer presence rather than effort. Your physical bearing communicates 'I'm here, and my being here matters.'`,
    friendship: `In friendship, your Leo rising brings warmth, loyalty, and visible enjoyment of the bond. Friends feel celebrated when you turn your attention toward them.`,
    romantic: `In romance, your Leo rising radiates confident charm and generous attention. First encounters often feel theatrically alive and personally honoring.`,
    feed: `Your rising sign carries Leo energy today. First impressions run warm, visible, and self-assured.`,
    sonic: `Your Leo Ascendant contributes bold melodic statements, radiant harmonic warmth, and rhythm that commands attention—the sound of dignified presence and generous self-expression.`,
  },

  PLCMT_ASCENDANT_VIRGO: {
    key: 'PLCMT_ASCENDANT_VIRGO',
    planet: 'ASCENDANT',
    sign: 'VIRGO',
    title: 'Ascendant in Virgo',
    core: `Your Ascendant in Virgo means you present with careful observation, practical modesty, and the energy of someone who's assessing how to be useful. People experience you as thoughtful, precise, and more interested in competence than performance.`,
    behavioral: `You approach situations by noticing what needs fixing or organizing, present yourself with clean efficiency rather than dramatic flair, and naturally offer helpful observations even when not asked. Your physical presence is understated and functional—you look like someone who's here to work, not to be admired.`,
    friendship: `In friendship, your Virgo rising shows up as practical help, thoughtful detail, and quiet reliability. Friends trust your observations even when you underplay yourself.`,
    romantic: `In romance, your Virgo rising signals discernment and understated care. Attraction grows through competence, attentiveness, and modest steadiness.`,
    feed: `Your rising sign carries Virgo energy today. Presence reads precise, helpful, and quietly competent.`,
    sonic: `Your Virgo Ascendant contributes precise melodic detail, refined harmonic clarity, and rhythm that is efficient and measured—the sound of careful attention and practical presence.`,
  },

  PLCMT_ASCENDANT_LIBRA: {
    key: 'PLCMT_ASCENDANT_LIBRA',
    planet: 'ASCENDANT',
    sign: 'LIBRA',
    title: 'Ascendant in Libra',
    core: `Your Ascendant in Libra means you present with graceful diplomacy, aesthetic awareness, and the energy of someone who instinctively seeks balance and harmony. People experience you as charming, fair-minded, and naturally skilled at making others feel considered and valued.`,
    behavioral: `You enter situations looking for the point of connection or agreement, adjust your presentation to create relational ease, and naturally mediate conflicts even when not directly involved. Your physical presence is poised and pleasing—you look like someone who cares how things (including yourself) are perceived.`,
    friendship: `In friendship, your Libra rising smooths friction, invites fairness, and keeps tone pleasant. Friends feel aesthetically and relationally considered.`,
    romantic: `In romance, your Libra rising opens with charm, balance, and mutual regard. First meetings often feel elegant and mutually attentive.`,
    feed: `Your rising sign carries Libra energy today. First contact favors harmony, grace, and relational balance.`,
    sonic: `Your Libra Ascendant contributes balanced melodic phrases, harmonious chord progressions, and rhythm that seeks equilibrium—the sound of graceful presence and relational attunement.`,
  },

  PLCMT_ASCENDANT_SCORPIO: {
    key: 'PLCMT_ASCENDANT_SCORPIO',
    planet: 'ASCENDANT',
    sign: 'SCORPIO',
    title: 'Ascendant in Scorpio',
    core: `Your Ascendant in Scorpio means you present with intense focus, psychological depth, and the energy of someone who sees through surfaces to what's hidden underneath. People experience you as powerful, private, and possessing a penetrating gaze that makes superficial conversation feel inadequate.`,
    behavioral: `You approach new situations with strategic caution, reveal only what serves your purposes, and naturally command respect through sheer intensity rather than explicit assertion. Your physical presence is magnetically controlled—you look like someone who could handle whatever darkness the situation might reveal.`,
    friendship: `In friendship, your Scorpio rising signals loyalty, depth, and discretion. Friends sense that secrets could be safe and that you see more than you say.`,
    romantic: `In romance, your Scorpio rising carries magnetic restraint and emotional gravity. First contact often feels fated, private, or impossible to ignore.`,
    feed: `Your rising sign carries Scorpio energy today. Presence reads intense, perceptive, and strategically contained.`,
    sonic: `Your Scorpio Ascendant contributes smoldering melodic intensity, dark harmonic depth, and rhythm that pulses with contained power—the sound of penetrating presence and strategic revelation.`,
  },

  PLCMT_ASCENDANT_SAGITTARIUS: {
    key: 'PLCMT_ASCENDANT_SAGITTARIUS',
    planet: 'ASCENDANT',
    sign: 'SAGITTARIUS',
    title: 'Ascendant in Sagittarius',
    core: `Your Ascendant in Sagittarius means you present with expansive enthusiasm, philosophical curiosity, and the energy of someone who's always ready for the next adventure. People experience you as optimistic, blunt, and carrying yourself with the freedom of someone who doesn't take social convention too seriously.`,
    behavioral: `You enter situations openly and without guile, speak your truth even when diplomacy might serve you better, and naturally inspire others through your genuine belief that life is meant to be explored. Your physical presence is unrestrained and broad—you look like someone who needs room to move and thinks borders are suggestions.`,
    friendship: `In friendship, your Sagittarius rising brings humor, honesty, and appetite for experience. Friends feel invited into a larger world when you're around.`,
    romantic: `In romance, your Sagittarius rising signals openness, adventure, and candid warmth. First meetings can feel exciting and slightly unbounded.`,
    feed: `Your rising sign carries Sagittarius energy today. First impressions run open, blunt, and forward-looking.`,
    sonic: `Your Sagittarius Ascendant contributes soaring melodic range, expansive harmonic openness, and rhythm that gallops toward the horizon—the sound of adventurous presence and philosophical freedom.`,
  },

  PLCMT_ASCENDANT_CAPRICORN: {
    key: 'PLCMT_ASCENDANT_CAPRICORN',
    planet: 'ASCENDANT',
    sign: 'CAPRICORN',
    title: 'Ascendant in Capricorn',
    core: `Your Ascendant in Capricorn means you present with serious authority, disciplined restraint, and the energy of someone who has earned their presence through competence. People experience you as responsible, mature beyond your years, and naturally commanding respect without demanding it.`,
    behavioral: `You carry yourself with measured dignity, speak only when you have something substantive to say, and demonstrate competence through action rather than words. Your physical presence communicates 'I'm here to accomplish something real, not to perform for approval.'`,
    friendship: `In friendship, your Capricorn rising reads as dependable, reserved, and structurally loyal. Friends trust your judgment and your follow-through.`,
    romantic: `In romance, your Capricorn rising signals seriousness and earned trust. Attraction respects maturity, reliability, and demonstrated character.`,
    feed: `Your rising sign carries Capricorn energy today. Presence reads composed, authoritative, and purpose-driven.`,
    sonic: `Your Capricorn Ascendant contributes austere melodic structure, authoritative harmonic foundations, and rhythm that builds with patient discipline—the sound of earned authority and enduring presence.`,
  },

  PLCMT_ASCENDANT_AQUARIUS: {
    key: 'PLCMT_ASCENDANT_AQUARIUS',
    planet: 'ASCENDANT',
    sign: 'AQUARIUS',
    title: 'Ascendant in Aquarius',
    core: `Your Ascendant in Aquarius means you present with detached originality, intellectual independence, and the energy of someone who's operating on a frequency slightly different from everyone else. People experience you as unconventional, principled, and genuinely unbothered by whether your approach matches social norms.`,
    behavioral: `You enter situations as an observer rather than a participant, present yourself as uniquely yourself without apology or explanation, and naturally challenge conventions through simply being who you are. Your physical presence is both friendly and remote—you look like someone who's here with you but also somewhere else entirely.`,
    friendship: `In friendship, your Aquarius rising offers originality, principled honesty, and respectful distance. Friends feel accepted as individuals rather than managed.`,
    romantic: `In romance, your Aquarius rising signals friendship-first chemistry and unconventional pacing. First contact can feel intriguing and slightly unpredictable.`,
    feed: `Your rising sign carries Aquarius energy today. First impressions read original, principled, and lightly detached.`,
    sonic: `Your Aquarius Ascendant contributes unexpected melodic intervals, innovative harmonic progressions, and rhythm that breaks conventional patterns—the sound of original presence and intellectual detachment.`,
  },

  PLCMT_ASCENDANT_PISCES: {
    key: 'PLCMT_ASCENDANT_PISCES',
    planet: 'ASCENDANT',
    sign: 'PISCES',
    title: 'Ascendant in Pisces',
    core: `Your Ascendant in Pisces means you present with gentle fluidity, emotional permeability, and the energy of someone whose boundaries are more porous than most. People experience you as compassionate, dreamy, and possessing an otherworldly quality that makes you seem like you're channeling something beyond yourself.`,
    behavioral: `You approach situations by absorbing the emotional atmosphere, adapt your presentation to reflect what others need from you, and naturally dissolve barriers between yourself and whoever you're with. Your physical presence is soft and yielding—you look like someone who could dissolve into mist if the world gets too harsh.`,
    friendship: `In friendship, your Pisces rising offers empathy, imaginative warmth, and nonjudgmental presence. Friends feel emotionally held without being fixed.`,
    romantic: `In romance, your Pisces rising signals softness, mystery, and romantic idealism in first contact. Partners sense depth beneath a gentle surface.`,
    feed: `Your rising sign carries Pisces energy today. Presence reads gentle, porous, and imaginatively receptive.`,
    sonic: `Your Pisces Ascendant contributes flowing melodic dissolve, ethereal harmonic wash, and rhythm that moves like water without edges—the sound of permeable presence and transcendent empathy.`,
  },
};
