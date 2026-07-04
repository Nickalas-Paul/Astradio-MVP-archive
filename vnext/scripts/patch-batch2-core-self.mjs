import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIELDS = {
  JUPITER_SUN_CONJUNCTION: {
    core_self:
      'Jupiter and the Sun in the same degree fuses your sense of identity with your drive toward expansion, meaning, and growth. Who you are is inseparable from what you believe in and where you are heading. You tend to experience yourself as someone still becoming rather than someone who has arrived.',
    behavioral_self:
      'You identify with possibility. Optimism is not just a mood but a core feature of how you understand yourself and your place in things.',
  },
  JUPITER_SUN_SEXTILE: {
    core_self:
      'Your sense of self and your expansive instinct find productive cooperation. The Sun and Jupiter in sextile gives your conscious identity a natural channel into your capacity for growth, faith, and meaning-making. Being who you are tends to open things rather than close them.',
    behavioral_self:
      'You carry a quality of enthusiasm that serves your sense of self without inflating it past what the situation can hold.',
  },
  JUPITER_SUN_SQUARE: {
    core_self:
      'Your sense of who you are and your drive toward expansion create friction. Jupiter pushes toward more; the Sun wants to define and hold a coherent identity. At 90 degrees, your need to grow and your need to know who you are can work against each other. Expansion can scatter your sense of self, and self-definition can feel limiting.',
    behavioral_self:
      'You sometimes overreach when you should consolidate, or hold back when growth is actually what the moment requires.',
  },
  JUPITER_SUN_TRINE: {
    core_self:
      'Your sense of self and your capacity for growth reinforce each other naturally. The Sun and Jupiter in trine means your identity and your expansive instinct flow in the same direction. Growth tends to confirm rather than disrupt your sense of who you are.',
    behavioral_self:
      'You tend to move through life with genuine confidence and a capacity for enlarging your world without losing yourself in the process.',
  },
  JUPITER_SUN_OPPOSITION: {
    core_self:
      'Your conscious sense of self and your expansive instinct operate at full polarity. The Sun and Jupiter in opposition means your drive to hold a clear identity and your drive to expand and grow pull in fundamentally different directions. Too much of one tends to cost you the other.',
    behavioral_self:
      'You experience a recurring tension between needing to be grounded in who you are and needing to become more than you currently are.',
  },
  JUPITER_MOON_CONJUNCTION: {
    core_self:
      'Jupiter and the Moon in the same degree fuses your emotional life with your drive toward expansion, generosity, and meaning. Your feelings are large. What moves you moves you fully, and your emotional instincts and your philosophical reach operate as one function.',
    behavioral_self:
      'You feel things at a scale that others sometimes find surprising. This is not excess; it is how your emotional life is built.',
  },
  JUPITER_MOON_SEXTILE: {
    core_self:
      'Your emotional instincts and your expansive drive find productive cooperation. The Moon and Jupiter in sextile means your feeling function and your capacity for growth and meaning work in compatible modes. What you feel tends to open toward something larger rather than closing inward.',
    behavioral_self:
      'You tend to process difficulty through a wider lens. Feeling and meaning-making move together for you rather than pulling apart.',
  },
  JUPITER_MOON_SQUARE: {
    core_self:
      'Your emotional instincts and your drive toward expansion create friction. The Moon needs security and containment; Jupiter needs to grow and reach beyond. At 90 degrees these two functions interfere with each other. Your need for emotional safety and your drive toward enlargement can pull against each other in ways that feel genuinely disorienting.',
    behavioral_self:
      'You sometimes expand emotionally beyond what you can integrate, or contract into safety when growth is actually what the moment requires.',
  },
  JUPITER_MOON_TRINE: {
    core_self:
      'Your emotional life and your expansive instinct reinforce each other naturally. The Moon and Jupiter in trine means your feeling function and your drive toward meaning flow in the same direction. Feeling and reaching tend to happen together rather than in opposition.',
    behavioral_self:
      'You tend to process emotion in ways that open into insight. Being moved by things tends to enlarge your world rather than destabilize it.',
  },
  JUPITER_MOON_OPPOSITION: {
    core_self:
      'Your emotional instincts and your expansive drive operate at full polarity. The Moon and Jupiter in opposition means the part of you that needs security and the part that needs to grow are at maximum distance from each other. Too much expansion can destabilize your emotional ground, and too much contraction can prevent the growth your spirit actually needs.',
    behavioral_self:
      'You experience a recurring tension between needing safety and needing more. Both pulls are real and both require tending.',
  },
  JUPITER_MERCURY_CONJUNCTION: {
    core_self:
      'Jupiter and Mercury in the same degree fuses your thinking with your drive toward expansion, philosophy, and meaning. Your mind does not stay small. Ideas naturally grow into frameworks and frameworks into worldviews. Your thinking has a reach that exceeds the immediately practical.',
    behavioral_self:
      'You tend to think big and communicate big. Synthesis and scope come naturally to how your mind moves through information.',
  },
  JUPITER_MERCURY_SEXTILE: {
    core_self:
      'Your thinking and your expansive instinct find productive cooperation. Mercury and Jupiter in sextile means your analytical function and your drive toward growth and meaning work in compatible modes. You can think precisely and also see the large picture without one undermining the other.',
    behavioral_self:
      'You tend to communicate with both clarity and vision. Others often find your thinking enlarging rather than merely informative.',
  },
  JUPITER_MERCURY_SQUARE: {
    core_self:
      'Your thinking and your drive toward expansion create friction. Mercury wants to analyze and understand accurately; Jupiter wants to grow and find meaning even when evidence is incomplete. At 90 degrees your precision and your scope work against each other, and you can overstate what you understand or understate what is actually larger than your current frame.',
    behavioral_self:
      'You sometimes think you know more than you do, or fail to trust what you know because it does not feel large enough yet.',
  },
  JUPITER_MERCURY_TRINE: {
    core_self:
      'Your thinking and your expansive instinct reinforce each other naturally. Mercury and Jupiter in trine means your analytical function and your drive toward growth and meaning flow in compatible directions. You can think clearly and think big without one compromising the other.',
    behavioral_self:
      'You tend to communicate in ways that enlarge the conversation. Precision and vision move together.',
  },
  JUPITER_MERCURY_OPPOSITION: {
    core_self:
      'Your rational mind and your expansive instinct operate at full polarity. Mercury and Jupiter in opposition means your drive to understand accurately and your drive to reach toward meaning pull in fundamentally different directions. Precision and scope do not easily coexist in the same moment.',
    behavioral_self:
      'You experience a recurring tension between needing to be accurate and needing to believe something larger. Finding the point where both feel satisfied takes sustained effort.',
  },
  JUPITER_VENUS_CONJUNCTION: {
    core_self:
      'Jupiter and Venus in the same degree fuses your sense of beauty with your expansive instinct. What you love, you love abundantly. Your relational warmth and your philosophical reach operate as one function, and these two planetary forces amplify each other rather than dividing your attention.',
    behavioral_self:
      'You tend to love generously and attract generosity in return. Warmth and openness enlarge each other in you.',
  },
  JUPITER_VENUS_SEXTILE: {
    core_self:
      'Your sense of beauty and connection and your expansive instinct find productive cooperation. Venus and Jupiter in sextile means your relational warmth and your drive toward growth and meaning work in compatible modes. Love and meaning tend to move toward each other in your life rather than away.',
    behavioral_self:
      'You tend to find that connection and expansion reinforce each other. Relationships tend to open things for you rather than close them down.',
  },
  JUPITER_VENUS_SQUARE: {
    core_self:
      'Your sense of beauty and connection and your drive toward expansion create friction. Venus wants to draw in and appreciate; Jupiter wants to reach beyond and grow. At 90 degrees your relational warmth and your need to expand can work against each other. You can overextend in love or pull back from connection because growth feels more important in a given moment.',
    behavioral_self:
      'You sometimes love too broadly to love deeply, or restrict connection in pursuit of something that feels larger. Both directions are part of this tension.',
  },
  JUPITER_VENUS_TRINE: {
    core_self:
      'Your sense of beauty and your expansive instinct reinforce each other naturally. Venus and Jupiter in trine means your relational warmth and your drive toward growth and meaning flow in compatible directions. Love and abundance tend to arrive together rather than competing for the same interior space.',
    behavioral_self:
      'You tend to be genuinely generous. Your warmth has a quality of scope that does not diminish with distribution.',
  },
  JUPITER_VENUS_OPPOSITION: {
    core_self:
      'Your sense of beauty and connection and your expansive drive operate at full polarity. Venus and Jupiter in opposition means your pull toward intimacy and appreciation and your drive toward expansion and meaning pull in fundamentally different directions. Closeness can feel limiting and expansion can feel lonely.',
    behavioral_self:
      'You experience a recurring tension between needing deep connection and needing to grow beyond where connection currently is. Both needs are real.',
  },
  JUPITER_MARS_CONJUNCTION: {
    core_self:
      "Jupiter and Mars in the same degree fuses your drive with your expansive instinct. Your ambition has philosophical reach. Your assertive energy does not just pursue immediate goals but tends toward something larger. Mars's force and Jupiter's vision operate as one function.",
    behavioral_self:
      'You tend to act with both conviction and scope. When you pursue something, you pursue it with a sense that it matters beyond the immediate.',
  },
  JUPITER_MARS_SEXTILE: {
    core_self:
      'Your drive and your expansive instinct find productive cooperation. Mars and Jupiter in sextile means your assertive energy and your drive toward growth and meaning work in compatible modes. Your ambition tends to be appropriately scaled and your action tends to be directed toward goals that genuinely mean something.',
    behavioral_self:
      'You tend to pursue things with both momentum and purpose. Action and meaning do not often compete in you.',
  },
  JUPITER_MARS_SQUARE: {
    core_self:
      'Your drive and your expansive instinct create friction. Mars wants to act and push; Jupiter wants to expand and sometimes overextend. At 90 degrees your energy and your ambition pull in different directions. You can act without adequate vision, or have a vision too large for the available energy and momentum.',
    behavioral_self:
      'You sometimes do more than the situation requires or plan more than you can execute. Both directions are part of this tension.',
  },
  JUPITER_MARS_TRINE: {
    core_self:
      'Your drive and your expansive instinct reinforce each other naturally. Mars and Jupiter in trine means your assertive energy and your drive toward growth and meaning flow in compatible directions. When you act, your action tends to be both energetic and appropriately scaled to what actually matters.',
    behavioral_self:
      'You tend to pursue goals that are worth pursuing. Drive and vision move together in you.',
  },
  JUPITER_MARS_OPPOSITION: {
    core_self:
      'Your drive and your expansive instinct operate at full polarity. Mars and Jupiter in opposition means your assertive energy and your need for meaning and growth pull in fundamentally different directions. Acting now and growing toward something larger do not easily coexist, and one tends to come at the expense of the other.',
    behavioral_self:
      'You experience a recurring tension between wanting to act immediately and wanting to reach toward something that requires patience and wider scope. Bridging the two is ongoing work.',
  },
  SATURN_SUN_CONJUNCTION: {
    core_self:
      "Saturn fused with the Sun means your sense of identity is organized around structure, discipline, and the pressure to earn rather than simply be. Your conscious self carries the weight of expectation, your own more than anyone else's. Who you understand yourself to be is shaped by what you have built and what you have proven.",
    behavioral_self:
      'You tend to take yourself seriously. Seriousness and self-respect are closely linked for you, and one tends to require the other.',
  },
  SATURN_SUN_SEXTILE: {
    core_self:
      'Your sense of self and your capacity for structure and discipline find productive cooperation. The Sun and Saturn in sextile means your purposeful identity has a natural working relationship with your instinct for building, responsibility, and long-term commitment. Being who you are supports the structures you want to build.',
    behavioral_self:
      'You tend to be both purposeful and reliable without feeling that one requires sacrificing the other.',
  },
  SATURN_SUN_SQUARE: {
    core_self:
      "Your sense of who you are and Saturn's demand for discipline and structure create real friction. The Sun wants to express and define itself openly; Saturn tests, restricts, and demands evidence before allowing full expression. At 90 degrees your identity is regularly pressured by your own internal critic. Self-expression can feel costly, and discipline can feel like self-erasure.",
    behavioral_self:
      'You work harder than most to feel entitled to take up space. That pressure is real and it has shaped you in ways that run deep.',
  },
  SATURN_SUN_TRINE: {
    core_self:
      'Your sense of self and your capacity for structure reinforce each other naturally. The Sun and Saturn in trine means your identity and your internal organizing principle flow in compatible directions. Being who you are tends to involve a steady, serious quality that others recognize as genuine authority rather than performance.',
    behavioral_self:
      'You tend to build well and build true. Patience and self-expression are not usually at war with each other.',
  },
  SATURN_SUN_OPPOSITION: {
    core_self:
      "Your conscious sense of self and Saturn's demand for discipline operate at maximum distance from each other. The Sun and Saturn in opposition means your drive to express your identity and your internal pressure to restrict, test, and prove pull in fundamentally different directions. What you want to be and what you feel you have to earn to be are often in conflict.",
    behavioral_self:
      'You experience a recurring tension between self-expression and self-discipline. Finding the point where they stop competing requires sustained and deliberate attention.',
  },
  SATURN_MOON_CONJUNCTION: {
    core_self:
      "Saturn and the Moon in the same degree means your emotional life is organized around structure, restraint, and the earned rather than the given. Your feelings do not flow easily or freely. Saturn's demand for discipline presses directly on the Moon's need for instinctive comfort. Emotional safety has to be built for you; it does not arrive on its own.",
    behavioral_self:
      'You tend to be serious about what you feel and careful about who receives it. Both qualities come from the same source.',
  },
  SATURN_MOON_SEXTILE: {
    core_self:
      'Your emotional instincts and your capacity for structure find productive cooperation. The Moon and Saturn in sextile means your feeling function and your organizing principle work in compatible modes. Structure tends to make you feel safer rather than more restricted, and your emotions tend to find appropriate form rather than requiring suppression.',
    behavioral_self:
      'You tend to be emotionally reliable. The stability you provide others usually comes from a genuine interior steadiness rather than performance.',
  },
  SATURN_MOON_SQUARE: {
    core_self:
      "Your emotional needs and Saturn's demand for discipline and structure create genuine friction. The Moon needs ease, instinct, and comfort; Saturn demands evidence, structure, and accountability. At 90 degrees your emotional body is regularly pressed by your own internal standard of control. Feeling things can feel like weakness, or controlling your feelings can leave you emotionally isolated.",
    behavioral_self:
      'You have had to work harder than most to feel that your emotional needs are legitimate. That internal pressure runs deep and is worth taking seriously.',
  },
  SATURN_MOON_TRINE: {
    core_self:
      'Your emotional life and your capacity for structure reinforce each other naturally. The Moon and Saturn in trine means your feeling function and your organizing principle flow in compatible directions. Discipline and emotional integrity are not competing values for you. Structure tends to make your emotional life more stable rather than more compressed.',
    behavioral_self:
      'You tend to feel deeply without being destabilized by what you feel. There is a quiet steadiness to your interior life.',
  },
  SATURN_MOON_OPPOSITION: {
    core_self:
      "Your emotional instincts and Saturn's demand for structure operate at full polarity. The Moon and Saturn in opposition means your need for emotional ease and your internal drive toward control and restriction are at maximum distance from each other. What your emotional body needs and what your internal authority demands are often in direct conflict.",
    behavioral_self:
      'You experience a recurring tension between needing comfort and needing discipline. Neither wins permanently, and managing both is ongoing work.',
  },
  SATURN_MERCURY_CONJUNCTION: {
    core_self:
      "Saturn and Mercury in the same degree means your thinking is organized around discipline, structure, and the pressure to get it exactly right. Your mind does not easily allow imprecision. Saturn's demand for rigor presses directly on Mercury's processing function. You think carefully, and with a seriousness that others sometimes mistake for pessimism.",
    behavioral_self:
      'You tend to be a thorough thinker. What you conclude has usually been tested against your own internal standard of proof before you share it.',
  },
  SATURN_MERCURY_SEXTILE: {
    core_self:
      'Your thinking and your capacity for structure find productive cooperation. Mercury and Saturn in sextile means your analytical function and your organizing principle work in compatible modes. Structure tends to make your thinking clearer rather than more restricted, and your mind tends toward the kind of precision that builds rather than merely analyzes.',
    behavioral_self:
      'You tend to communicate with authority. Your thinking has weight because it has been worked through.',
  },
  SATURN_MERCURY_SQUARE: {
    core_self:
      "Your thinking and Saturn's demand for rigor create friction. Mercury wants to explore, connect, and communicate; Saturn demands discipline and accountability before speaking. At 90 degrees these two functions interfere with each other. Your mind can be blocked by your own internal critic, or you override the critic and later regret the imprecision.",
    behavioral_self:
      'You sometimes cannot say what you think because it does not feel adequate yet. Waiting for perfection regularly delays what only needed to be good enough.',
  },
  SATURN_MERCURY_TRINE: {
    core_self:
      'Your thinking and your capacity for structure reinforce each other naturally. Mercury and Saturn in trine means your analytical function and your organizing principle flow in compatible directions. Rigor and precision are not burdens for you but natural features of how your mind moves through problems.',
    behavioral_self:
      'You tend to think with depth and communicate with authority. What you say usually means something.',
  },
  SATURN_MERCURY_OPPOSITION: {
    core_self:
      "Your rational mind and Saturn's demand for structure operate at full polarity. Mercury and Saturn in opposition means your drive to think and communicate freely and your internal pressure toward discipline and restriction pull in fundamentally different directions. Your mind can feel simultaneously compelled to explore and compelled to limit its own exploration.",
    behavioral_self:
      'You experience a recurring tension between wanting to think freely and needing to get it exactly right. The two modes do not easily share space.',
  },
  SATURN_VENUS_CONJUNCTION: {
    core_self:
      "Saturn and Venus in the same degree means your sense of beauty and connection is organized around seriousness, earning, and the test of time. Love that comes easily tends to feel suspect. What you build in relationship is built carefully and without shortcuts. Saturn's demand for proof presses directly on Venus's instinct for warmth and ease.",
    behavioral_self:
      'You tend to love with loyalty and depth but not always with lightness. What you commit to, you take seriously.',
  },
  SATURN_VENUS_SEXTILE: {
    core_self:
      'Your sense of beauty and your capacity for structure find productive cooperation. Venus and Saturn in sextile means your relational warmth and your organizing principle work in compatible modes. Structure and affection do not compete in you. You can be both warm and reliable without one requiring the sacrifice of the other.',
    behavioral_self:
      'You tend to create durable connections. The warmth you offer is the kind that holds across time rather than just across good conditions.',
  },
  SATURN_VENUS_SQUARE: {
    core_self:
      "Your sense of beauty and connection and Saturn's demand for discipline and structure create genuine friction. Venus needs ease, warmth, and pleasure; Saturn demands accountability, restraint, and evidence. At 90 degrees your relational instinct and your internal standard of worthiness can work against each other. Love can feel unearned or discipline can feel unloving.",
    behavioral_self:
      'You sometimes feel you have to earn what should be freely given, or find that freely given warmth cannot be trusted. Both tendencies come from the same internal pressure.',
  },
  SATURN_VENUS_TRINE: {
    core_self:
      'Your sense of beauty and your capacity for structure reinforce each other naturally. Venus and Saturn in trine means your relational warmth and your organizing principle flow in compatible directions. Discipline and love are not competing values for you. What you commit to holds.',
    behavioral_self:
      'You tend to build relationships that last because you build them carefully and maintain them with genuine steadiness rather than intermittent intensity.',
  },
  SATURN_VENUS_OPPOSITION: {
    core_self:
      "Your sense of beauty and connection and Saturn's demand for structure operate at full polarity. Venus and Saturn in opposition means your pull toward warmth, ease, and pleasure and your internal pressure toward discipline, restriction, and earned merit pull in fundamentally different directions. Wanting to be loved and feeling like you have to earn it are often in direct conflict.",
    behavioral_self:
      'You experience a recurring tension between needing warmth and needing to deserve it. The opposition keeps asking you to accept love without first building the case for why you qualify.',
  },
  SATURN_MARS_CONJUNCTION: {
    core_self:
      "Saturn and Mars in the same degree means your drive is organized around structure, discipline, and the earned rather than the impulsive. Your assertive energy does not fire easily or freely. Saturn's demand for discipline presses directly on Mars's need to act. When you do move, you move with deliberation and real weight.",
    behavioral_self:
      'You tend to be the person who follows through when others have stopped. Your endurance comes from somewhere deep and does not depend on mood.',
  },
  SATURN_MARS_SEXTILE: {
    core_self:
      'Your drive and your capacity for structure find productive cooperation. Mars and Saturn in sextile means your assertive energy and your organizing principle work in compatible modes. Structure tends to direct your drive rather than suppress it, and your drive gives your structures real forward momentum.',
    behavioral_self:
      'You tend to act with both intention and endurance. What you pursue, you pursue to completion.',
  },
  SATURN_MARS_SQUARE: {
    core_self:
      "Your drive and Saturn's demand for discipline and structure create real friction. Mars wants to act and push; Saturn demands restraint and accountability before moving. At 90 degrees these two functions work against each other in ways that produce frustration, blocked energy, or explosive release after prolonged suppression.",
    behavioral_self:
      'You sometimes suppress drive until it becomes pressure that is harder to manage, or act impulsively to escape the feeling of being held back. Both responses are part of this tension.',
  },
  SATURN_MARS_TRINE: {
    core_self:
      'Your drive and your capacity for structure reinforce each other naturally. Mars and Saturn in trine means your assertive energy and your organizing principle flow in compatible directions. Discipline and drive are not competing forces in you. Your energy tends to be sustained rather than impulsive, and sustained energy is what actually builds things.',
    behavioral_self:
      'You tend to be effective over time rather than just intense in the moment. That is a significant and durable advantage.',
  },
  SATURN_MARS_OPPOSITION: {
    core_self:
      "Your drive and Saturn's demand for structure operate at full polarity. Mars and Saturn in opposition means your assertive energy and your internal pressure toward restraint and discipline are at maximum distance from each other. The part of you that needs to act and the part that needs to control action are in direct conflict.",
    behavioral_self:
      'You experience a recurring tension between needing to move and needing to hold back. Finding the rhythm between assertion and restraint is work that does not resolve quickly.',
  },
};

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../projection/insight-library');
const files = {
  jupiter: path.join(root, 'insight-library-aspects-jupiter.ts'),
  saturn: path.join(root, 'insight-library-aspects-saturn.ts'),
  mercury: path.join(root, 'insight-library-aspects-mercury.ts'),
};

function keysForFile(filePath) {
  return Object.keys(FIELDS).filter((key) => {
    if (filePath.includes('jupiter.ts')) {
      return key.startsWith('JUPITER_') && !key.includes('MERCURY');
    }
    if (filePath.includes('saturn.ts')) {
      return key.startsWith('SATURN_') && !key.includes('MERCURY');
    }
    if (filePath.includes('mercury.ts')) {
      return key.startsWith('JUPITER_MERCURY') || key.startsWith('SATURN_MERCURY');
    }
    return false;
  });
}

function patchFile(filePath, keys) {
  let content = fs.readFileSync(filePath, 'utf8');
  let patched = 0;
  for (const key of keys) {
    const { core_self, behavioral_self } = FIELDS[key];
    if (new RegExp(`${key}[\\s\\S]{0,12000}core_self:`).test(content)) {
      console.warn(`skip ${key} — already has core_self`);
      continue;
    }
    const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const insert = ` core_self: '${esc(core_self)}',\n behavioral_self: '${esc(behavioral_self)}',`;
    const re = new RegExp(
      `(${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:[\\s\\S]*?behavioral_synastry: \`[^\`]*\`,)\\n( friendship_synastry:)`,
    );
    if (!re.test(content)) {
      console.error(`FAILED ${key} in ${path.basename(filePath)}`);
      process.exit(1);
    }
    content = content.replace(re, `$1\n${insert}\n$2`);
    patched++;
  }
  fs.writeFileSync(filePath, content);
  return patched;
}

let total = 0;
for (const [name, filePath] of Object.entries(files)) {
  const n = patchFile(filePath, keysForFile(filePath));
  console.log(`${name}: ${n}`);
  total += n;
}
console.log(`total patched: ${total} (expected 50)`);
if (total !== 50) process.exit(1);
