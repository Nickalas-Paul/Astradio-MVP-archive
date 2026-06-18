/**
 * Apply Batch 1 Tier 1 Feed library content (transit fields, feed rewrites, direction fixes).
 * Run: npx tsx vnext/scripts/apply-batch1-tier1-feed.ts
 */
import * as fs from 'fs';
import * as path from 'path';

type Patch = {
  key: string;
  file: 'mercury' | 'personal';
  feed?: string;
  core_transit?: string;
  behavioral_transit?: string;
};

const MERCURY = path.join(__dirname, '../projection/insight-library/insight-library-aspects-mercury.ts');
const PERSONAL = path.join(__dirname, '../projection/insight-library/insight-library-aspects-personal.ts');

// Patches keyed by aspect key , content from Batch 1 deliverable
const PATCHES: Patch[] = [
  // Section A + B mercury cluster
  {
    key: 'MERCURY_MARS_CONJUNCTION',
    file: 'mercury',
    core_transit: `Mercury, articulation and strategic thought, meets Mars, raw drive and the force that moves without waiting, at the same degree. What you think and what you pursue are fused during this 2-3 day window. Your mind isn't analyzing your actions from outside. It's inside the action, thinking from within the momentum rather than about it. This produces unusual clarity about what you actually want because the gap between articulation and execution has collapsed. When Mercury and Mars occupy the same space, thought converts to action without the usual friction that allows second-guessing. The gift is decisive clarity. The shadow is acting before you've verified the thought is accurate.`,
    behavioral_transit: `Saying it and doing it are the same gesture during this window. When you articulate what you want, your body is already moving toward it. Use this for goals that need committed execution rather than endless strategic refinement, confrontations where clarity matters more than diplomacy, projects where Mercury's precision and Mars's force both serve the same outcome. The conjunction won't create the desire if it's absent, but it removes the gap between knowing what you want and actually pursuing it when both are genuinely present.`,
    feed: `Mercury and Mars are meeting at the same degree between these charts today. One person's articulation and the other person's drive are fused right now. The current sky is opening a window where thinking and acting aren't separate. When one person's Mercury articulates something, the other person's Mars is already moving toward it. When Mars acts, Mercury can think clearly about that action without undermining the momentum. Use this for shared pursuits that need both strategic clarity and committed execution happening simultaneously rather than competing for priority.`,
  },
  {
    key: 'MERCURY_MARS_OPPOSITION',
    file: 'mercury',
    core_transit: `Mercury opposes Mars across 180 degrees, maximum distance between articulation and action. What you're thinking and what you're pursuing are pulling in opposite directions during this 2-3 day period. Your mind and your body are at full polarity. When Mercury wants to analyze, Mars wants to move, and vice versa. The opposition holds both as equally real rather than one surrendering to the other. This produces the split between knowing what to do and actually doing it. When you're thinking clearly, you're not acting; when you're acting decisively, you're not thinking strategically.`,
    behavioral_transit: `You'll see clearly the gap between what you're saying and what you're actually pursuing. The opposition doesn't resolve by choosing thought over action or action over thought. It resolves by recognizing that both are legitimate and learning to operate across the distance. Use this window to get honest about whether your articulated plans match your actual momentum, or whether Mercury is describing one direction while Mars pursues another. The work is course correction without invalidating either the thinking or the drive.`,
  },
  {
    key: 'MERCURY_MARS_SEXTILE',
    file: 'mercury',
    core_transit: `Mercury forms a sextile to Mars, 60 degrees of productive cooperation between thinking and acting. Your articulation and your drive are operating in compatible modes during this 2-3 day window. What you think can support what you pursue without strain, and what you're moving toward can inform what you're saying without forcing strategic compromise. This aspect provides enough distance that you can think about your actions without the thinking erasing the momentum. Mercury and Mars have breathing room from each other, thought and force can work together productively.`,
    behavioral_transit: `Talking about what you want to do actually helps you do it during this window rather than replacing the doing with endless planning. Mercury's precision and Mars's execution are compatible rather than competing. Use this for projects that benefit from both strategic clarity and committed action, conversations that need both articulate framing and decisive follow-through, goals where thinking and moving support each other rather than one dominating. The sextile won't force movement where desire is absent, but it makes coordination between mind and body available when both are engaged.`,
  },
  {
    key: 'MERCURY_MARS_TRINE',
    file: 'mercury',
    core_transit: `Mercury forms a trine to Mars, 120 degrees in the same elemental family. Your thinking and your drive are drawing from the same source during this 2-3 day window. What you articulate and what you pursue recognize each other as kin. Mercury's strategic clarity and Mars's physical force are operating in natural harmony, thought about action and the action itself are moving in the same current without friction. This produces intellectual decisiveness that feels effortless. When you think about what you want, the body is already prepared to move toward it. When Mars engages, Mercury can articulate the strategy without undermining the momentum.`,
    behavioral_transit: `Creative execution feels wholehearted during this window. What you're making and what you're thinking about making are aligned without internal negotiation. Use this for work that requires both Mercury's precision and Mars's sustained force, projects that benefit from strategic clarity backing physical effort, goals where thought and action are drawing from the same elemental drive. The trine won't push you toward unfamiliar territory, but it makes coordinated pursuit of what you already want genuinely smooth while the aspect is active.`,
    feed: `Mercury and Mars are flowing together between these charts today in natural harmony. One person's articulation and the other person's drive are drawing from the same elemental source right now. The current sky is amplifying how easily strategic thinking and decisive action support each other in this connection. When Mercury articulates a plan, Mars can execute it without the usual friction. When Mars moves, Mercury can think clearly about that movement without undermining the force. Use this for shared goals that need both precision and momentum operating together.`,
  },
  {
    key: 'MERCURY_MARS_SQUARE',
    file: 'mercury',
    core_transit: `Mercury forms a square to Mars, 90 degrees of sustained friction between thinking and acting. What you can articulate clearly and what you're actively pursuing are cutting across each other during this 2-3 day period. Your mind and your drive are both operating at full strength but in geometrically incompatible directions. This friction isn't pathological. Mercury is thinking legitimately and Mars is pursuing legitimately, but they're asking for incompatible things. The productive response is recognizing which situations need intellectual precision and which need decisive action, then choosing one mode rather than trying to satisfy both simultaneously.`,
    behavioral_transit: `You'll feel the pull between "think this through clearly" and "just move forward" more intensely during this window. Mercury says analyze, refine, get logical; Mars says act, execute, don't wait. The square means both impulses are valid but incompatible in the same moment. Use this friction to examine whether you're using intellectual analysis to demolish what's genuinely worth pursuing, or whether Martian force is preventing clear thinking about what actually works. The conflict resolves through conscious choice about which planet the situation requires, not through compromise the square doesn't support.`,
    feed: `Mercury and Mars are at friction point between these charts right now. One person's thinking and the other person's drive are cutting across each other today with more geometric precision than on an ordinary day. The current sky is making visible the structural gap between articulation and action in this connection, conversations about what to do next may reveal that Mercury needs to process while Mars needs to commit. The friction isn't pathological; it's the square making the difference between analysis and execution more visible than usual. There's something useful in naming that gap rather than forcing convergence that the transit field isn't supporting right now.`,
  },
  // MOON_MERCURY in mercury file
  {
    key: 'MOON_MERCURY_CONJUNCTION',
    file: 'mercury',
    core_transit: `The Moon, emotional instinct and the body's immediate responses, meets Mercury, articulation and strategic thought, at the same degree. What you feel and how you think aren't separate systems during this 6-8 hour window. They run on the same current. Your emotional body and your cognitive function are fused. What you feel, you can name; how you articulate, you can feel in your body. Mercury isn't analyzing feelings from outside; it's inside the feeling, thinking from within emotional experience rather than about it. This produces unusual fluency in emotional articulation that others read as emotionally intelligent and present.`,
    behavioral_transit: `Talking through a feeling and having the feeling are the same process during this window. Writing about emotion and processing emotion are identical activities right now. The Moon and Mercury conjunction means your thinking is never purely abstract. It's colored by what your body is feeling. And your feelings arrive with words already attached. Use this for conversations that need emotional honesty backed by clear articulation, creative work that expresses genuine feeling with precision, moments that benefit from being able to name what's happening emotionally before it escalates into overwhelm.`,
    feed: `The Moon and Mercury are meeting at the same degree between these charts today. One person's emotional instinct and the other person's thinking are fused right now. The current sky is opening a window where feeling and articulation aren't separate. When one person's Moon is experiencing emotion, the other person's Mercury can name it before it escalates into overwhelm. When Mercury articulates feeling, the Moon recognizes it as accurate rather than distanced. Use this for conversations that need both emotional honesty and clear language operating together.`,
  },
  {
    key: 'MOON_MERCURY_OPPOSITION',
    file: 'mercury',
    core_transit: `The Moon opposes Mercury across 180 degrees, maximum distance between feeling and thinking. What you're experiencing emotionally and what you're able to articulate are at opposite poles during this 6-8 hour period. Your emotional body and your cognitive function are pulling in different directions. When you feel something clearly, you can't find words for it; when you can articulate something precisely, you've lost connection to the actual feeling. The opposition holds both as equally real. This produces the split between emotional experience and the capacity to think about that experience clearly.`,
    behavioral_transit: `You see the gap between what you're feeling and what you're able to say about it. The opposition doesn't resolve by choosing feeling over thought or thought over feeling. It resolves by recognizing that both are legitimate and learning to hold the distance between them. Use this window to notice whether you're using Mercury to analyze away what the Moon is actually experiencing, or whether emotional overwhelm is preventing the clear thinking you need. The work is honoring both without forcing them to merge when the geometry doesn't support integration.`,
  },
  {
    key: 'MOON_MERCURY_SEXTILE',
    file: 'mercury',
    core_transit: `The Moon forms a sextile to Mercury, 60 degrees of productive cooperation between feeling and thinking. What you're feeling emotionally and how you're thinking are operating in compatible modes during this 6-8 hour window. Your emotional instinct and your cognitive clarity can support each other without strain. This aspect provides enough distance that you can think about your feelings without the thinking erasing the feeling, and feel without losing the capacity for clear thought. The Moon and Mercury have breathing room from each other.`,
    behavioral_transit: `Processing feelings verbally actually helps during this window rather than distancing you from the emotion. The Moon and Mercury sextile means talking about what you're experiencing and actually experiencing it are compatible rather than opposed. Use this for conversations that need both emotional honesty and clear articulation, creative work that expresses genuine feeling with Mercury's precision, relationships that benefit from being able to name what's happening emotionally without the naming replacing the feeling itself.`,
  },
  {
    key: 'MOON_MERCURY_SQUARE',
    file: 'mercury',
    core_transit: `The Moon forms a square to Mercury, 90 degrees of sustained friction between feeling and thinking. What your body needs emotionally and what your mind wants to articulate are cutting across each other during this 6-8 hour period. Your lunar reactions and your Mercury function are both operating at full strength but in geometrically incompatible directions. This friction isn't a failure of either planet. The Moon is feeling legitimately and Mercury is thinking legitimately, but they're not cooperating. The productive response is recognizing which situations need emotional presence and which need cognitive clarity, then choosing one mode rather than trying to satisfy both simultaneously.`,
    behavioral_transit: `You'll feel the pull between "honor what I'm feeling" and "think this through clearly" more sharply during this window. The Moon says feel it fully, stay in the body; Mercury says analyze it, get some distance, find the words. The square means both impulses are real but incompatible in the same moment. Use this friction diagnostically: situations where you keep oscillating between feeling and thinking without landing on either probably need you to choose the Moon or Mercury consciously and let the other function quiet temporarily. The conflict resolves through deliberate choice, not through finding a middle ground the square doesn't geometrically support.`,
    feed: `The Moon and Mercury are at friction point between these charts today. One person's emotional experience and the other person's articulation are cutting across each other right now with more geometric force than usual. The current sky is making visible the gap between feeling and thinking in this connection. When the Moon needs emotional presence, Mercury wants to analyze; when Mercury articulates clearly, the Moon experiences it as distanced from actual feeling. The friction is structural. There's something to work with in naming that difference rather than forcing the Moon and Mercury to operate in ways that don't match their actual geometry.`,
  },
  {
    key: 'MOON_MERCURY_TRINE',
    file: 'mercury',
    core_transit: `The Moon forms a trine to Mercury, 120 degrees in the same elemental family. What you're feeling emotionally and how you're thinking are drawing from the same source during this 6-8 hour window. Your emotional instinct and your cognitive clarity recognize each other as kin. The Moon's reactive responses and Mercury's articulate precision are operating in natural harmony. When you feel something, the words are already available. When Mercury articulates emotion, the Moon recognizes it as accurate.`,
    behavioral_transit: `Processing feelings verbally actually helps during this window rather than distancing you from the emotion. The Moon and Mercury trine means talking about what you're experiencing and actually experiencing it are compatible rather than opposed. Use this for conversations that need both emotional honesty and clear articulation, creative work that expresses genuine feeling with Mercury's precision, relationships that benefit from being able to name what's happening emotionally without the naming replacing the feeling itself. The trine makes emotional fluency available but won't create feelings where they're absent.`,
    feed: `The Moon and Mercury are flowing together between these charts today with natural ease. One person's emotional instinct and the other person's thinking are drawing from the same elemental source right now. The current sky is amplifying how easily feeling and articulation support each other in this connection. When the Moon is experiencing emotion, Mercury can name it without distancing from the feeling. When Mercury articulates, the Moon recognizes it as emotionally accurate. Use this for conversations that need both emotional honesty and clear language without the two modes fighting.`,
  },
  {
    key: 'MERCURY_VENUS_CONJUNCTION',
    file: 'mercury',
    core_transit: `Mercury, articulation and strategic thought, meets Venus, aesthetic value and relational attunement, at the same degree. What you think and what you find beautiful occupy the same space during this 2-3 day window. Your mind and your sense of beauty are fused. When you articulate something, it's aesthetically considered; when you're drawn to beauty, you can think clearly about why. Mercury isn't analyzing value from outside; it's inside the aesthetic experience, thinking from within what's beautiful rather than about it. This produces unusual clarity about what you actually value because thought and taste aren't in competition.`,
    behavioral_transit: `Talking about what you love and actually loving it are the same gesture during this window. When you articulate aesthetic judgment, it's genuine rather than performed. The Mercury-Venus conjunction means thinking and valuing are operating as one function. Your mind serves your taste and your taste informs your thinking without friction. Use this for conversations about beauty that need both clarity and genuine appreciation, creative decisions where Mercury's precision and Venus's aesthetics support each other, relationships where articulating care and feeling care are aligned. The risk is mistaking the clarity of the articulation for the depth of the actual feeling.`,
    feed: `Mercury and Venus are meeting at the same degree between these charts today. One person's thinking and the other person's aesthetic sense are fused right now. The current sky is opening a window where articulation and beauty aren't separate. When one person's Mercury speaks clearly, the other person's Venus receives it as beautiful. When Venus expresses aesthetic value, Mercury can think about that value without undermining it. Use this for conversations about what matters that need both clarity and genuine appreciation operating together.`,
  },
  {
    key: 'MERCURY_VENUS_OPPOSITION',
    file: 'mercury',
    core_transit: `Mercury opposes Venus across 180 degrees, maximum distance between articulation and aesthetic value. What you can think clearly about and what you find beautiful are at opposite poles during this 2-3 day period. Your mind and your sense of value are pulling in different directions. When Mercury articulates something precisely, it loses aesthetic appeal; when Venus is drawn to beauty, Mercury can't find the logic. The opposition holds both as equally legitimate. This produces the split between intellectual clarity and aesthetic attunement.`,
    behavioral_transit: `You see clearly the gap between what makes sense to Mercury and what Venus actually values. The opposition doesn't resolve by choosing thought over beauty or beauty over thought. It resolves by recognizing that both are real and learning to operate across the distance. Use this window to get honest about whether you're using Mercury's analysis to undermine what Venus genuinely finds beautiful, or whether aesthetic attraction is overriding what your mind knows doesn't actually work. The work is holding both intellectual clarity and aesthetic truth without forcing them to agree when the geometry doesn't support convergence.`,
  },
  {
    key: 'MERCURY_VENUS_SEXTILE',
    file: 'mercury',
    core_transit: `Mercury forms a sextile to Venus, 60 degrees of productive cooperation between thinking and valuing. What you can articulate clearly and what you find aesthetically appealing are operating in compatible modes during this 2-3 day window. Your mind and your sense of beauty can support each other without strain. This aspect provides enough distance that you can value something aesthetically without the valuing erasing clear thought, and think clearly without analysis demolishing taste.`,
    behavioral_transit: `Articulating what you value actually deepens your appreciation during this window rather than distancing you from it. Mercury and Venus sextile means thinking about beauty and experiencing beauty are compatible rather than opposed. Use this for conversations about aesthetics that need both clarity and genuine feeling, creative work where precision serves beauty rather than constraining it, relationships where you can think clearly about care without the thinking replacing the actual warmth.`,
  },
  {
    key: 'MERCURY_VENUS_SQUARE',
    file: 'mercury',
    core_transit: `Mercury forms a square to Venus, 90 degrees of sustained friction between thinking and valuing. What you can articulate clearly and what you find aesthetically appealing are cutting across each other during this 2-3 day period. Your mind and your sense of beauty are both operating at full strength but in geometrically incompatible directions. This friction isn't pathological. Mercury is thinking legitimately and Venus is valuing legitimately, but they're asking for incompatible things. The productive response is recognizing which situations need intellectual precision and which need aesthetic grace, then choosing one mode rather than trying to satisfy both simultaneously.`,
    behavioral_transit: `You'll feel the pull between "think this through clearly" and "honor what's beautiful" more intensely during this window. Mercury says analyze, refine, get logical; Venus says appreciate, value, let it be beautiful even if it doesn't make complete sense. The square means both impulses are valid but incompatible in the same moment. Use this friction to examine whether you're using intellectual analysis to demolish what's genuinely beautiful, or whether aesthetic preference is preventing clear thinking about what actually works. The conflict resolves through conscious choice about which planet the situation requires, not through compromise the square doesn't support.`,
    feed: `Mercury and Venus are at friction point between these charts today. One person's thinking and the other person's aesthetic sense are cutting across each other with more geometric precision than usual right now. The current sky is making visible the tension between intellectual clarity and relational beauty in this connection. When Mercury articulates precisely, Venus experiences it as lacking grace. When Venus values something aesthetically, Mercury can't find the logic. The friction is structural. There's something useful in naming that gap rather than forcing thought and beauty to align when the geometry doesn't support convergence.`,
  },
  {
    key: 'MERCURY_VENUS_TRINE',
    file: 'mercury',
    core_transit: `Mercury forms a trine to Venus, 120 degrees in the same elemental family. What you think and what you value are drawing from the same source during this 2-3 day window. Your mind and your aesthetic sense recognize each other as kin. Mercury's articulate precision and Venus's relational grace are operating in natural harmony. When you think about beauty, the thinking serves the beauty; when Venus values something, Mercury can articulate why without undermining it. This produces aesthetic intelligence that feels effortless. Clear thinking and genuine taste support each other naturally.`,
    behavioral_transit: `Articulating what you value actually deepens your appreciation during this window rather than distancing you from it. Mercury and Venus trine means thinking about beauty and experiencing beauty are compatible rather than opposed. Use this for conversations about aesthetics that need both clarity and genuine feeling, creative work where precision serves beauty rather than constraining it, relationships where you can think clearly about care without the thinking replacing the actual warmth. The trine makes this coordination available but won't create taste where genuine aesthetic engagement is absent.`,
    feed: `Mercury and Venus are flowing together between these charts today in natural harmony. One person's thinking and the other person's aesthetic sense are drawing from the same elemental source right now. The current sky is amplifying how easily articulation and beauty support each other in this connection. When Mercury thinks clearly, Venus finds that clarity beautiful. When Venus values something aesthetically, Mercury can articulate why without undermining the appreciation. Use this for conversations that need both precision and grace operating together.`,
  },
  // Feed-only / jupiter mercury in mercury file
  {
    key: 'SUN_MERCURY_TRINE',
    file: 'mercury',
    feed: `The Sun and Mercury are flowing together between these charts today with natural ease. One person's identity and the other person's thinking are drawing from the same elemental source right now. The current sky is amplifying how easily one person's authentic self-expression translates into clear understanding for the other person's mind. Recognition feels effortless during this window. When one shows up as themselves, the other gets it without translation. Use this for conversations that benefit from both authenticity and intellectual clarity operating together rather than competing.`,
  },
  {
    key: 'SUN_MERCURY_OPPOSITION',
    file: 'mercury',
    feed: `The Sun and Mercury are at opposite poles between these charts today. One person's identity and the other person's thinking are at maximum distance from each other right now. The current sky is making visible the gap between authentic self-expression and intellectual analysis in this connection. When one person is being themselves, the other person's mind is observing from outside that experience rather than from within it. The distance isn't failure. It's the opposition showing you that being seen and being understood don't always arrive together. There's something to work with in naming that gap rather than pretending convergence is happening when the transit field doesn't support it.`,
  },
  {
    key: 'JUPITER_MERCURY_CONJUNCTION',
    file: 'mercury',
    feed: `Jupiter and Mercury are meeting at the same degree between these charts today. One person's expansion impulse and the other person's thinking are fused right now. The current sky is opening a window where big vision and articulate precision aren't competing. When one person's Jupiter wants to grow, the other person's Mercury can think strategically about that growth without constraining it. When Mercury articulates a plan, Jupiter can see the larger possibility without dismissing the precision. Use this for conversations about shared goals that need both vision and strategic clarity operating together.`,
  },
  {
    key: 'JUPITER_MERCURY_SQUARE',
    file: 'mercury',
    feed: `Jupiter and Mercury are at friction point between these charts today. One person's expansion impulse and the other person's articulate precision are cutting across each other with more geometric force than usual right now. The current sky is making visible the tension between thinking big and thinking clearly in this connection. When Jupiter wants to expand, Mercury applies analytical constraints; when Mercury articulates details, Jupiter experiences it as limiting vision. The friction isn't pathological, both the expansion and the precision are legitimate. There's something useful in naming that structural difference rather than forcing one planet to surrender.`,
  },
  {
    key: 'JUPITER_MERCURY_TRINE',
    file: 'mercury',
    feed: `Jupiter and Mercury are flowing together between these charts today in natural cooperation. One person's expansion impulse and the other person's thinking are drawing from the same elemental source right now. The current sky is amplifying how easily big vision and strategic articulation support each other in this connection. When Jupiter wants to grow, Mercury knows how to think about that growth constructively. When Mercury articulates strategy, Jupiter can see the larger possibility it serves. Use this for planning that needs both vision and precision, conversations where expansion and clarity are allies rather than competitors.`,
  },
];

// Personal file patches , continued in second array for maintainability
const PERSONAL_PATCHES: Patch[] = [
  {
    key: 'MOON_VENUS_CONJUNCTION',
    file: 'personal',
    core_transit: `The Moon, emotional need and instinctive response, meets Venus, aesthetic value and relational attunement, at the same degree. What you need emotionally and what you find beautiful aren't separate during this 6-8 hour window. They occupy the same space. Your lunar body and your Venus function are fused. What feels safe and what feels beautiful are the same thing right now. When you're drawn to something aesthetically, it's also what your emotional body needs. When your Moon seeks comfort, it shows up as attraction to beauty. This produces relational warmth that feels completely natural and unperformed.`,
    behavioral_transit: `Reaching out and caring are the same gesture during this window. When you express affection, it's genuinely serving your own emotional need rather than performing connection. The Moon-Venus conjunction means self-care and other-care aren't in competition. What soothes you and what creates beauty in relationship are aligned. Use this for moments that need authentic warmth without strategic positioning, creative work that expresses genuine feeling through aesthetic form, relationships where showing care and receiving care are happening simultaneously without calculation.`,
    feed: `The Moon and Venus are meeting at the same degree between these charts today. One person's emotional need and the other person's sense of beauty are fused right now. The current sky is opening a window where comfort and aesthetic appeal aren't separate. What soothes one person and what the other person finds beautiful are aligned. When the Moon needs emotional safety, Venus recognizes that need as worthy of care. When Venus expresses beauty, the Moon experiences it as genuinely comforting. Use this for moments that need both emotional authenticity and relational grace operating together.`,
  },
  {
    key: 'MOON_VENUS_OPPOSITION',
    file: 'personal',
    core_transit: `The Moon opposes Venus across 180 degrees, maximum distance between emotional need and aesthetic value. What your body needs for safety and what you find relationally beautiful are at opposite poles during this 6-8 hour period. Your lunar instinct and your Venus function are pulling in different directions. When you feel emotionally secure, it's in ways that aren't aesthetically pleasing; when you're drawn to beauty, it's at the cost of what your Moon actually needs. The opposition holds both as equally legitimate. This produces the split between emotional authenticity and relational grace.`,
    behavioral_transit: `You see clearly the gap between what actually soothes you and what looks beautiful to others. The opposition doesn't resolve by choosing the Moon's needs over Venus's aesthetics or Venus's grace over the Moon's requirements. It resolves by recognizing that both are real and learning to operate across the distance. Use this window to get honest about whether you're performing relational beauty while your actual emotional needs go unmet, or whether you're so committed to lunar authenticity that you've abandoned Venus's capacity for grace entirely. The work is honoring both without forcing integration the geometry doesn't support.`,
  },
  {
    key: 'MOON_VENUS_SQUARE',
    file: 'personal',
    core_transit: `The Moon forms a square to Venus, 90 degrees of sustained friction between emotional need and relational attunement. What your body needs for safety and what creates aesthetic harmony are cutting across each other during this 6-8 hour period. Your lunar reactions and your Venus function are both operating at full strength but in geometrically incompatible directions. This friction isn't pathological. The Moon is needing legitimately and Venus is valuing legitimately, but they're asking for incompatible things. The productive response is recognizing which moments need lunar authenticity and which need Venusian grace, then choosing one mode fully rather than trying to satisfy both simultaneously.`,
    behavioral_transit: `You'll feel the pull between "say what I actually need" and "maintain relational harmony" more intensely during this window. The Moon says be emotionally honest even if it's awkward; Venus says create beauty even if it requires restraint. The square means both impulses are valid but incompatible in the same moment. Use this friction to examine whether you're sacrificing genuine emotional needs for aesthetic performance, or whether lunar rawness is demolishing Venus's capacity for grace. The conflict resolves through conscious choice about which planet the situation actually requires, not through finding a compromise position the square doesn't geometrically offer.`,
    feed: `The Moon and Venus are at friction point between these charts today. One person's emotional need and the other person's aesthetic sense are cutting across each other with more geometric precision than usual right now. The current sky is making visible the tension between lunar authenticity and Venusian grace in this connection. When the Moon needs emotional honesty, Venus experiences it as aesthetically awkward. When Venus creates relational beauty, the Moon experiences it as emotionally inauthentic. The friction is structural. There's something useful in naming that gap rather than forcing one planet to surrender.`,
  },
  {
    key: 'MOON_VENUS_TRINE',
    file: 'personal',
    core_transit: `The Moon forms a trine to Venus, 120 degrees in the same elemental family. What you need emotionally and what you find beautiful are drawing from the same source during this 6-8 hour window. Your lunar instinct and your Venus function recognize each other as kin. The Moon's emotional authenticity and Venus's relational grace are operating in natural harmony. What soothes you and what creates beauty in connection are moving in the same current without friction. This produces warmth that feels both genuine and graceful. When you express care, it's emotionally real and aesthetically attuned simultaneously.`,
    behavioral_transit: `Self-care and relational beauty support each other naturally during this window. What your Moon needs and what Venus values aren't in competition. They're compatible. Use this for moments that benefit from emotional honesty delivered with grace, relationships where authenticity and aesthetic attunement are both present, creative work that expresses genuine feeling in beautiful form. The trine makes this coordination available but won't manufacture warmth where emotional engagement is actually absent. The ease is real but temporary. Use it while the aspect is active.`,
    feed: `The Moon and Venus are flowing together between these charts today in natural harmony. One person's emotional need and the other person's aesthetic sense are drawing from the same elemental source right now. The current sky is amplifying how easily emotional authenticity and relational beauty support each other in this connection. When the Moon expresses genuine need, Venus receives it as beautiful rather than burdensome. When Venus creates grace, the Moon experiences it as emotionally real rather than performed. Use this for moments that need both warmth and beauty operating together.`,
  },
  {
    key: 'MOON_MARS_CONJUNCTION',
    file: 'personal',
    core_transit: `The Moon, emotional instinct and reactive need, meets Mars, drive and physical force, at the same degree. What you feel and what you pursue aren't separate during this 6-8 hour window. Your emotional body and your Mars function are fused. When you feel something, you're already moving toward or away from it. When Mars acts, it's emotionally driven rather than strategically planned. This produces reactive intensity that others experience as authentic but potentially overwhelming. Your feelings have immediate physical expression; your actions are emotionally honest rather than calculated.`,
    behavioral_transit: `What you want and what you feel are the same impulse during this window. When emotion arises, Mars is already engaged, anger becomes action, desire becomes pursuit, fear becomes withdrawal without the gap that allows choice. The Moon-Mars conjunction means emotional authenticity and physical force are operating as one function. Use this for moments that need wholehearted commitment where feeling and doing support each other, confrontations that benefit from emotional honesty backed by real force, pursuits where desire is both felt deeply and acted on decisively. The risk is acting on every feeling without the pause that allows discernment.`,
    feed: `The Moon and Mars are meeting at the same degree between these charts today. One person's emotional instinct and the other person's drive are fused right now. The current sky is opening a window where feeling and action aren't separate. When one person's Moon experiences emotion, the other person's Mars is already responding to it physically. When Mars acts, the Moon recognizes the action as emotionally coherent rather than disconnected. Use this for moments that need both emotional honesty and decisive response operating together without the gap that allows hesitation.`,
  },
  {
    key: 'MOON_MARS_OPPOSITION',
    file: 'personal',
    core_transit: `The Moon opposes Mars across 180 degrees, maximum distance between emotional need and drive. What your body needs for safety and what you're pursuing actively are at opposite poles during this 6-8 hour period. Your lunar instinct and your Mars function are pulling in different directions. When you feel emotionally secure, you're not moving; when Mars is engaged, your emotional body feels threatened. The opposition holds both as equally legitimate. This produces the split between emotional safety and the capacity to act decisively.`,
    behavioral_transit: `You see clearly the gap between what you need emotionally and what you're actually pursuing. The opposition doesn't resolve by choosing lunar safety over Martian action or Mars's drive over the Moon's needs. It resolves by recognizing that both are real and learning to operate across the distance. Use this window to get honest about whether you're sacrificing genuine emotional needs for the sake of forward momentum, or whether lunar withdrawal is preventing legitimate pursuit. The work is holding both the need and the drive without forcing them to merge when the geometry doesn't support integration.`,
  },
  {
    key: 'MOON_MARS_SQUARE',
    file: 'personal',
    core_transit: `The Moon forms a square to Mars, 90 degrees of sustained friction between emotional reaction and physical drive. What your body needs for safety and what you're actively pursuing are cutting across each other during this 6-8 hour period. Your lunar responses and your Mars function are both operating at full strength but in geometrically incompatible directions. This friction isn't a failure. The Moon is needing legitimately and Mars is pursuing legitimately, but they're asking you to move in incompatible ways simultaneously. The productive response is recognizing which situations need emotional tending and which need decisive action, then choosing one mode rather than trying to honor both at once.`,
    behavioral_transit: `You'll feel the pull between "tend to what I'm feeling" and "just move forward" more intensely during this window. The Moon says stop, feel this, give it space; Mars says act, execute, don't let emotion slow you down. The square means both impulses are valid but incompatible in the same moment. Use this friction to examine whether you're overriding genuine emotional signals to maintain momentum, or whether lunar reactivity is preventing action that actually needs to happen. The conflict resolves through conscious choice about which planet the situation requires, not through compromise the square doesn't geometrically support.`,
    feed: `The Moon and Mars are at friction point between these charts today. One person's emotional need and the other person's drive are cutting across each other with more geometric force than usual right now. The current sky is making visible the tension between lunar safety and Martian action in this connection. When the Moon needs emotional tending, Mars experiences it as preventing forward movement. When Mars pursues decisively, the Moon experiences it as threatening safety. The friction is structural. There's something to work with in naming that difference rather than forcing the Moon and Mars to operate compatibly when the geometry doesn't support it.`,
  },
  {
    key: 'MOON_MARS_TRINE',
    file: 'personal',
    core_transit: `The Moon forms a trine to Mars, 120 degrees in the same elemental family. What you feel emotionally and what you pursue physically are drawing from the same source during this 6-8 hour window. Your lunar instinct and your Mars function recognize each other as kin. The Moon's emotional responses and Mars's drive are operating in natural harmony. When you feel something, the body knows how to move with it rather than against it. When Mars acts, it's emotionally coherent rather than forcing movement your lunar body doesn't support. This produces action that feels wholehearted and authentic.`,
    behavioral_transit: `Emotional honesty and decisive action support each other naturally during this window. What you feel and what you pursue aren't in competition. When the Moon is engaged, Mars knows what to do with that engagement. Use this for pursuits that need both emotional commitment and physical follow-through, confrontations where feeling fuels appropriate force rather than undermining it, goals where desire is emotionally real and physically sustainable. The trine makes this coordination available but won't create passion where genuine feeling is absent. The ease is real but temporary.`,
    feed: `The Moon and Mars are flowing together between these charts today with natural ease. One person's emotional instinct and the other person's drive are drawing from the same elemental source right now. The current sky is amplifying how easily feeling and action support each other in this connection. When the Moon experiences emotion, Mars knows how to move with it rather than against it. When Mars acts decisively, the Moon experiences it as emotionally coherent rather than threatening. Use this for moments that need both emotional authenticity and physical momentum operating together.`,
  },
  // Section C direction fixes + feed for personal
  {
    key: 'SUN_MOON_SEXTILE',
    file: 'personal',
    core_transit: `The Moon, emotional instinct and the body's immediate responses, forms a sextile to the Sun, conscious identity and the principle of deliberate self-expression, creating a 6-8 hour window of productive cooperation. Your lunar reactions and your solar aims are operating in compatible modes rather than competing for priority. What your body needs emotionally is supporting what you're trying to express publicly instead of undermining it. The ease is structural. When these two functions cooperate, authentic presence doesn't require performance because the emotional ground is stable enough to allow visibility. This won't build anything on its own, but it removes the friction that usually makes showing up as yourself feel risky.`,
    behavioral_transit: `Reaching out feels emotionally coherent during this window rather than forced. Your Moon isn't pulling you back into safety while your Sun tries to occupy space. The sextile means emotional safety and public visibility are compatible rather than opposed right now. Use this for moments that need authentic self-expression without emotional self-sabotage. The impulse to be seen and the need to feel secure are moving in the same direction, which is temporary but genuine while the aspect is active.`,
  },
  {
    key: 'SUN_MOON_SQUARE',
    file: 'personal',
    core_transit: `The Moon forms a square to the Sun, 90 degrees of sustained friction between emotional instinct and conscious identity. What your body needs for safety and what you're trying to express publicly are cutting across each other during this 6-8 hour period. Your lunar reactions and your solar aims are both operating at full strength but in geometrically incompatible directions. This friction isn't a failure. The Moon is needing legitimately and the Sun is expressing legitimately, but they're asking for incompatible things. The productive response is recognizing which moments need lunar safety and which need solar visibility, then choosing one mode rather than trying to satisfy both simultaneously.`,
    behavioral_transit: `You'll feel the pull between "protect what I need emotionally" and "show up publicly" more intensely during this window. The Moon says retreat, stay safe, don't risk exposure; the Sun says be visible, express yourself, occupy space. The square means both impulses are valid but incompatible in the same moment. Use this friction to examine whether you're overriding genuine emotional needs for the sake of public presence, or whether lunar withdrawal is preventing authentic self-expression that actually needs to happen. The conflict resolves through conscious choice about which planet the situation requires.`,
  },
  {
    key: 'SUN_MOON_TRINE',
    file: 'personal',
    core_transit: `The Moon forms a trine to the Sun, 120 degrees in the same elemental family. Your emotional instinct and your conscious identity are drawing from the same source during this 6-8 hour window. What your body needs emotionally and what you're trying to express publicly recognize each other as kin. The Moon's reactive responses and the Sun's deliberate visibility are operating in natural harmony. When you're being authentic, your emotional body supports it; when your Moon needs something, your Sun can express that need without shame. This produces presence that feels wholehearted and unperformed.`,
    behavioral_transit: `Showing up feels emotionally coherent during this window. What you express publicly and what you actually need aren't in competition. When your Sun is visible, your Moon doesn't undermine it; when your Moon needs something, your Sun can state it clearly. Use this for moments that need both authentic self-expression and emotional integrity operating together without friction. The trine makes this coordination available but won't create presence where genuine engagement is absent.`,
  },
  {
    key: 'SUN_MOON_OPPOSITION',
    file: 'personal',
    core_transit: `The Moon opposes the Sun across 180 degrees, maximum distance between emotional need and conscious identity. What your body needs for safety and what you're trying to express publicly are at opposite poles during this 6-8 hour period. Your lunar instinct and your solar aims are pulling in different directions. When you're emotionally secure, you're not visible; when your Sun is expressing, your Moon feels exposed. The opposition holds both as equally real. This produces the split between emotional authenticity and public presence.`,
    behavioral_transit: `You see clearly the gap between what you need emotionally and what you're showing publicly. The opposition doesn't resolve by choosing lunar safety over solar visibility or the Sun's expression over the Moon's needs. It resolves by recognizing that both are legitimate and learning to operate across the distance. Use this window to get honest about whether you're performing publicly while your actual emotional needs go unmet, or whether lunar withdrawal is preventing authentic self-expression. The work is holding both without forcing integration the geometry doesn't support.`,
  },
  {
    key: 'SUN_MOON_CONJUNCTION',
    file: 'personal',
    core_transit: `The Moon, emotional instinct and reactive need, meets the Sun, conscious identity and deliberate expression, at the same degree. This is the New Moon of your personal lunar cycle. What you feel and who you are occupy the same space during this 6-8 hour window. Your emotional body and your conscious aims are fused. When you're being authentic, you're emotionally engaged; when your Moon reacts, it's in service of your solar identity. This produces wholehearted presence that feels completely natural but potentially overwhelming to others because there's no gap between feeling and expression.`,
    behavioral_transit: `Being yourself and feeling genuinely are the same gesture during this window. When you express your identity, it's emotionally real; when you feel something, it shows. The Moon-Sun conjunction means emotional authenticity and public presence aren't separate functions right now. Use this for moments that need wholehearted engagement where feeling and expression serve each other, new beginnings that require both emotional commitment and conscious intention operating together. The risk is losing the gap between internal experience and external expression that sometimes serves as protection.`,
  },
  {
    key: 'SUN_MARS_SEXTILE',
    file: 'personal',
    core_transit: `Mars, drive and physical force, forms a sextile to the Sun, conscious identity and deliberate self-expression, creating a 3-5 day window of productive cooperation. Your drive and your sense of self are operating in compatible modes. What you want to pursue and who you actually are can support each other without strain. Mars's force and the Sun's identity have breathing room from each other, action and authentic presence can work together productively without one overwhelming the other.`,
    behavioral_transit: `Pursuing what you want feels aligned with who you are during this window rather than forcing you to perform someone else's version of success. Mars's drive and the Sun's identity are compatible. When you act, it's in service of your actual self rather than an image. Use this for goals that need both committed force and authentic direction, pursuits where action and identity support each other rather than competing.`,
  },
  {
    key: 'SUN_MARS_SQUARE',
    file: 'personal',
    core_transit: `Mars forms a square to the Sun, 90 degrees of sustained friction between drive and identity. What you're actively pursuing and who you actually are cut across each other during this 3-5 day period. Mars's force and the Sun's conscious aims are both operating at full strength but in geometrically incompatible directions. This friction isn't pathological. Mars is driving legitimately and the Sun is expressing legitimately, but they're asking you to be incompatible versions of yourself. The productive response is recognizing whether your current pursuit serves your actual identity or whether Mars is chasing goals that don't match who the Sun knows you to be.`,
    behavioral_transit: `You'll feel the tension between "act decisively" and "stay true to who I am" more sharply during this window. Mars says pursue this goal with full force; the Sun says that goal doesn't match my actual identity. The square means both impulses are valid but incompatible. Use this friction to examine whether you're pursuing ambitions that don't serve your genuine self, or whether solar identity is preventing legitimate growth Mars is trying to achieve. The conflict resolves through conscious choice about which planet to honor in this specific situation.`,
  },
  {
    key: 'SUN_MARS_TRINE',
    file: 'personal',
    core_transit: `Mars forms a trine to the Sun, 120 degrees in the same elemental family. Your drive and your identity are drawing from the same source during this 3-5 day window. What you're pursuing and who you are recognize each other as kin. Mars's physical force and the Sun's conscious expression are operating in natural harmony. When you act, it's in service of your actual self; when your Sun expresses identity, Mars can back it with real force. This produces action that feels wholehearted and authentic.`,
    behavioral_transit: `Pursuing goals feels aligned with your genuine identity during this window. What you're fighting for and who you actually are aren't in competition. Mars's drive serves the Sun's authentic expression naturally. Use this for pursuits that need both committed force and genuine direction, goals where action and identity are drawing from the same elemental source. The trine makes this coordination available but won't create passion where genuine desire is absent.`,
  },
  {
    key: 'SUN_VENUS_SEXTILE',
    file: 'personal',
    core_transit: `Venus, aesthetic value and relational attunement, forms a sextile to the Sun, conscious identity and self-expression, creating a 3-5 day window of productive cooperation. Your sense of beauty and your sense of self are operating in compatible modes. What you value aesthetically and who you actually are can support each other without strain. Venus's grace and the Sun's authenticity have breathing room from each other, beauty and genuine presence can work together productively.`,
    behavioral_transit: `Being yourself and being graceful feel compatible during this window rather than opposed. Venus's aesthetic sense and the Sun's authentic expression aren't competing. When you show up as yourself, it can include beauty; when you create relational grace, it doesn't require performing someone you're not. Use this for moments that need both genuine presence and aesthetic attunement operating together.`,
  },
  {
    key: 'SUN_VENUS_SQUARE',
    file: 'personal',
    core_transit: `Venus forms a square to the Sun, 90 degrees of sustained friction between aesthetic value and identity. What you find beautiful and who you actually are cut across each other during this 3-5 day period. Venus's sense of grace and the Sun's authentic expression are both operating at full strength but in geometrically incompatible directions. This friction isn't pathological. Venus is valuing legitimately and the Sun is expressing legitimately, but they're asking for incompatible things. The productive response is recognizing when to honor Venus's aesthetics and when to honor solar authenticity, then choosing one mode rather than trying to be both beautiful and genuine simultaneously when the geometry doesn't support it.`,
    behavioral_transit: `You'll feel the pull between "be aesthetically pleasing" and "be genuinely yourself" more intensely during this window. Venus says create relational beauty even if it requires restraint; the Sun says express who you actually are even if it's not graceful. The square means both impulses are valid but incompatible in the same moment. Use this friction to examine whether you're performing beauty at the cost of authentic presence, or whether solar rawness is demolishing Venus's capacity for grace entirely.`,
  },
  {
    key: 'SUN_VENUS_OPPOSITION',
    file: 'personal',
    core_transit: `Venus opposes the Sun across 180 degrees, maximum distance between aesthetic value and conscious identity. What you find beautiful and who you actually are sit at opposite poles during this 3-5 day period. Venus's sense of grace and the Sun's authentic expression are pulling in different directions. When you're being genuine, it's not beautiful; when you're creating beauty, you're not being yourself. The opposition holds both as equally legitimate. This produces the split between relational grace and authentic presence.`,
    behavioral_transit: `You see clearly the gap between being aesthetically pleasing and being genuinely yourself. The opposition doesn't resolve by choosing Venus's beauty over solar authenticity or the Sun's genuineness over Venusian grace. It resolves by recognizing that both are real and learning to operate across the distance. Use this window to get honest about whether you're performing relational beauty while your actual self goes unexpressed, or whether solar authenticity is demolishing every attempt at grace. The work is holding both without forcing them to merge when the geometry doesn't support integration.`,
  },
  {
    key: 'VENUS_MARS_CONJUNCTION',
    file: 'personal',
    core_transit: `Venus, aesthetic value and relational attunement, meets Mars, drive and physical force, at the same degree. What you find beautiful and what you pursue actively occupy the same space during this 3-5 day window. Your sense of grace and your capacity for decisive action are fused. When you value something, you're already moving toward it; when Mars acts, it's in service of what Venus finds beautiful. This produces desire that's both aesthetically attuned and physically committed, attraction that includes force rather than just appreciation.`,
    behavioral_transit: `Valuing something and pursuing it are the same gesture during this window. When Venus finds something beautiful, Mars is already engaged. When Mars moves, it's toward what Venus genuinely values rather than pursuing goals that don't match your aesthetic. Use this for relationships that need both attraction and action, creative work that requires both beauty and sustained force, moments where grace and decisiveness serve the same outcome. The conjunction makes passionate commitment available but won't create desire where genuine attraction is absent.`,
    feed: `Mars and Venus are meeting at the same degree between these charts today. One person's drive and the other person's aesthetic sense are fused right now. The current sky is opening a window where action and beauty aren't separate. When one person's Mars pursues something, the other person's Venus finds that pursuit beautiful. When Venus values something aesthetically, Mars can move toward it decisively. Use this for moments that need both force and grace, passion that includes beauty, desire that's both active and aesthetically attuned.`,
  },
  {
    key: 'VENUS_MARS_OPPOSITION',
    file: 'personal',
    core_transit: `Venus opposes Mars across 180 degrees, maximum distance between aesthetic value and drive. What you find beautiful and what you're actively pursuing are at opposite poles during this 3-5 day period. Venus's sense of grace and Mars's physical force are pulling in different directions. When you're creating beauty, you're not acting; when Mars is engaged, you're not being graceful. The opposition holds both as equally legitimate. This produces the split between relational attunement and decisive action.`,
    behavioral_transit: `You see clearly the gap between what you value aesthetically and what you're actually pursuing. The opposition doesn't resolve by choosing Venus's beauty over Martian action or Mars's drive over Venusian grace. It resolves by recognizing that both are real and learning to operate across the distance. Use this window to get honest about whether you're pursuing goals that don't match what you actually find beautiful, or whether aesthetic preference is preventing action that needs to happen. The work is holding both without forcing them to merge when the geometry doesn't support it.`,
  },
  {
    key: 'VENUS_MARS_SEXTILE',
    file: 'personal',
    core_transit: `Venus forms a sextile to Mars, 60 degrees of productive cooperation between aesthetic value and drive. What you find beautiful and what you actively pursue are operating in compatible modes during this 3-5 day window. Venus's grace and Mars's force can support each other without strain. This aspect provides enough distance that you can value something aesthetically without the valuing erasing the action, and pursue something decisively without Mars overriding Venus's requirement for beauty. Grace and force have breathing room from each other.`,
    behavioral_transit: `Creating beauty and taking action feel compatible during this window rather than opposed. Venus's aesthetics and Mars's drive aren't competing. When you value something, Mars can pursue it without the force demolishing the grace; when Mars acts, Venus can find that action beautiful rather than crude. Use this for relationships that need both attraction and momentum, creative work that requires both aesthetic attunement and committed execution, moments where beauty and decisiveness support each other rather than one dominating.`,
  },
  {
    key: 'VENUS_MARS_SQUARE',
    file: 'personal',
    core_transit: `Venus forms a square to Mars, 90 degrees of sustained friction between aesthetic value and drive. What you find beautiful and what you're actively pursuing cut across each other during this 3-5 day period. Venus's sense of grace and Mars's physical force are both operating at full strength but in geometrically incompatible directions. This friction isn't pathological. Venus is valuing legitimately and Mars is pursuing legitimately, but they're asking for incompatible things. The productive response is recognizing when to honor Venus's aesthetics and when to honor Martian action, then choosing one mode rather than trying to be both graceful and forceful simultaneously.`,
    behavioral_transit: `You'll feel the pull between "maintain beauty" and "act decisively" more sharply during this window. Venus says create grace even if it requires restraint; Mars says pursue with full force even if it's not pretty. The square means both impulses are valid but incompatible in the same moment. Use this friction to examine whether you're sacrificing necessary action for the sake of maintaining aesthetic appeal, or whether Martian force is demolishing Venus's capacity for relational beauty entirely. The conflict resolves through conscious choice about which planet the situation actually requires.`,
    feed: `Mars and Venus are at friction point between these charts today. One person's drive and the other person's aesthetic sense are cutting across each other with more geometric force than usual right now. The current sky is making visible the tension between Martian action and Venusian beauty in this connection. When Mars pursues decisively, Venus experiences it as lacking grace. When Venus creates relational beauty, Mars experiences it as preventing forward movement. The friction is structural. There's something to work with in naming that difference rather than forcing action and aesthetics to align when the geometry doesn't support it.`,
  },
  {
    key: 'VENUS_MARS_TRINE',
    file: 'personal',
    feed: `Mars and Venus are flowing together between these charts today with natural ease. One person's drive and the other person's aesthetic sense are drawing from the same elemental source right now. The current sky is amplifying how easily action and beauty support each other in this connection. When Mars pursues something, Venus finds that pursuit graceful rather than crude. When Venus values something, Mars can move toward it without the usual friction between force and aesthetics. Use this for moments that need both passion and beauty operating together.`,
  },
  {
    key: 'SUN_VENUS_CONJUNCTION',
    file: 'personal',
    feed: `The Sun and Venus are meeting at the same degree between these charts today. One person's identity and the other person's aesthetic sense are fused right now. The current sky is opening a window where authentic self-expression and relational beauty aren't separate. When one person's Sun shows up as themselves, the other person's Venus finds that authenticity beautiful. When Venus expresses care, the Sun experiences it as affirming rather than constraining. Use this for moments that need both genuine presence and aesthetic grace operating together.`,
  },
  {
    key: 'SUN_VENUS_TRINE',
    file: 'personal',
    feed: `The Sun and Venus are flowing together between these charts today in natural harmony. One person's identity and the other person's aesthetic sense are drawing from the same elemental source right now. The current sky is amplifying how easily authentic self-expression and relational beauty support each other in this connection. When the Sun is being genuine, Venus finds that genuineness beautiful. When Venus creates grace, the Sun experiences it as affirming rather than constraining. Use this for moments that need both authenticity and beauty without the two modes competing.`,
  },
];

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyPatch(filePath: string, patch: Patch): boolean {
  let src = fs.readFileSync(filePath, 'utf8');
  const keyRe = new RegExp(`(\\s+${escapeForRegex(patch.key)}:\\s*\\{)([\\s\\S]*?)(\\n\\s+\\},)`);
  const m = src.match(keyRe);
  if (!m) {
    console.error('MISSING KEY', patch.key, 'in', filePath);
    return false;
  }
  let body = m[2]!;

  if (patch.feed !== undefined) {
    const feedRe = /\n\s+feed:\s*`[^`]*`,/;
    if (!feedRe.test(body)) {
      console.error('NO FEED FIELD', patch.key);
      return false;
    }
    body = body.replace(feedRe, `\n    feed: \`${patch.feed}\`,`);
  }

  if (patch.core_transit !== undefined) {
    if (/\n\s+core_transit:/.test(body)) {
      body = body.replace(/\n\s+core_transit:\s*`[^`]*`,/, `\n    core_transit: \`${patch.core_transit}\`,`);
    } else {
      // Insert before closing of entry , after last synastry or sonic block
      const insertBefore = body.lastIndexOf('\n    romantic_synastry:');
      if (insertBefore === -1) {
        body = body.trimEnd() + `\n    core_transit: \`${patch.core_transit}\`,`;
      } else {
        const afterRom = body.indexOf('`,', insertBefore);
        if (afterRom === -1) {
          console.error('PARSE FAIL romantic_synastry', patch.key);
          return false;
        }
        body =
          body.slice(0, afterRom + 3) +
          `\n    core_transit: \`${patch.core_transit}\`,` +
          body.slice(afterRom + 3);
      }
    }
  }

  if (patch.behavioral_transit !== undefined) {
    if (/\n\s+behavioral_transit:/.test(body)) {
      body = body.replace(
        /\n\s+behavioral_transit:\s*`[^`]*`,/,
        `\n    behavioral_transit: \`${patch.behavioral_transit}\`,`
      );
    } else if (/\n\s+core_transit:/.test(body)) {
      body = body.replace(
        /(\n\s+core_transit:\s*`[^`]*`,)/,
        `$1\n    behavioral_transit: \`${patch.behavioral_transit}\`,`
      );
    } else {
      body = body.trimEnd() + `\n    behavioral_transit: \`${patch.behavioral_transit}\`,`;
    }
  }

  src = src.replace(keyRe, `$1${body}$3`);
  fs.writeFileSync(filePath, src, 'utf8');
  return true;
}

const all = [...PATCHES, ...PERSONAL_PATCHES];
let ok = 0;
let fail = 0;
for (const p of all) {
  const fp = p.file === 'mercury' ? MERCURY : PERSONAL;
  if (applyPatch(fp, p)) ok++;
  else fail++;
}
console.log({ applied: ok, failed: fail, total: all.length });
if (fail > 0) process.exit(1);
