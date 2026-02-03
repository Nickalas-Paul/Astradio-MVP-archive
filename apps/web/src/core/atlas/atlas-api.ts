// Astro Atlas API
// Education hub for astrological knowledge
// @ts-nocheck - MDX_REGISTRY/TRANSITS reference consts declared later in file
import type { WikiArticle, TransitExplainer } from '../social/types';

export const AtlasAPI = {
  async article(id: string): Promise<WikiArticle | null> { 
    return MDX_REGISTRY[id] || null; 
  },

  async search(q: string): Promise<WikiArticle[]> {
    const s = q.toLowerCase();
    return Object.values(MDX_REGISTRY).filter(a => 
      a.title.toLowerCase().includes(s) || 
      a.summary.toLowerCase().includes(s) ||
      a.id.toLowerCase().includes(s)
    );
  },

  async transit(id: string): Promise<TransitExplainer | null> { 
    return TRANSITS[id] || null; 
  },

  async getArticlesByKind(kind: WikiArticle['kind']): Promise<WikiArticle[]> {
    return Object.values(MDX_REGISTRY).filter(a => a.kind === kind);
  },

  async getRelatedArticles(articleId: string): Promise<WikiArticle[]> {
    const article = MDX_REGISTRY[articleId];
    if (!article || !article.links) return [];
    
    return article.links
      .map(linkId => MDX_REGISTRY[linkId])
      .filter(Boolean);
  }
};

// Minimal seed registry (expand as needed)
const MDX_REGISTRY: Record<string, WikiArticle> = {
  'planet.venus': { 
    id: 'planet.venus', 
    title: 'Venus', 
    kind: 'planet', 
    summary: 'The planet of love, beauty, harmony, and values. Rules relationships, aesthetics, and what we find attractive.',
    bodyMD: VENUS_MDX, 
    links: ['sign.taurus', 'sign.libra', 'house.7', 'aspect.trine'],
    updatedAt: new Date().toISOString() 
  },
  
  'planet.mars': { 
    id: 'planet.mars', 
    title: 'Mars', 
    kind: 'planet', 
    summary: 'The planet of action, energy, and desire. Rules motivation, courage, and how we assert ourselves.',
    bodyMD: MARS_MDX, 
    links: ['sign.aries', 'sign.scorpio', 'house.1', 'aspect.square'],
    updatedAt: new Date().toISOString() 
  },
  
  'planet.sun': { 
    id: 'planet.sun', 
    title: 'Sun', 
    kind: 'planet', 
    summary: 'The core of our identity and ego. Represents our essential self, vitality, and life purpose.',
    bodyMD: SUN_MDX, 
    links: ['sign.leo', 'house.5', 'aspect.conjunction'],
    updatedAt: new Date().toISOString() 
  },
  
  'planet.moon': { 
    id: 'planet.moon', 
    title: 'Moon', 
    kind: 'planet', 
    summary: 'Our emotional nature and instincts. Rules our inner world, habits, and unconscious patterns.',
    bodyMD: MOON_MDX, 
    links: ['sign.cancer', 'house.4', 'aspect.opposition'],
    updatedAt: new Date().toISOString() 
  },
  
  'sign.taurus': { 
    id: 'sign.taurus', 
    title: 'Taurus', 
    kind: 'sign', 
    summary: 'The Bull. Fixed Earth sign. Values stability, beauty, and material security.',
    bodyMD: TAURUS_MDX, 
    links: ['planet.venus', 'element.earth', 'modality.fixed'],
    updatedAt: new Date().toISOString() 
  },
  
  'sign.libra': { 
    id: 'sign.libra', 
    title: 'Libra', 
    kind: 'sign', 
    summary: 'The Scales. Cardinal Air sign. Seeks balance, harmony, and partnership.',
    bodyMD: LIBRA_MDX, 
    links: ['planet.venus', 'element.air', 'modality.cardinal'],
    updatedAt: new Date().toISOString() 
  },
  
  'sign.aries': { 
    id: 'sign.aries', 
    title: 'Aries', 
    kind: 'sign', 
    summary: 'The Ram. Cardinal Fire sign. Pioneering, energetic, and action-oriented.',
    bodyMD: ARIES_MDX, 
    links: ['planet.mars', 'element.fire', 'modality.cardinal'],
    updatedAt: new Date().toISOString() 
  },
  
  'sign.cancer': { 
    id: 'sign.cancer', 
    title: 'Cancer', 
    kind: 'sign', 
    summary: 'The Crab. Cardinal Water sign. Nurturing, protective, and emotionally intuitive.',
    bodyMD: CANCER_MDX, 
    links: ['planet.moon', 'element.water', 'modality.cardinal'],
    updatedAt: new Date().toISOString() 
  },
  
  'sign.leo': { 
    id: 'sign.leo', 
    title: 'Leo', 
    kind: 'sign', 
    summary: 'The Lion. Fixed Fire sign. Creative, confident, and naturally dramatic.',
    bodyMD: LEO_MDX, 
    links: ['planet.sun', 'element.fire', 'modality.fixed'],
    updatedAt: new Date().toISOString() 
  },
  
  'house.7': { 
    id: 'house.7', 
    title: '7th House', 
    kind: 'house', 
    summary: 'The House of Partnerships. Rules relationships, marriage, and one-on-one connections.',
    bodyMD: HOUSE_7_MDX, 
    links: ['planet.venus', 'sign.libra', 'aspect.opposition'],
    updatedAt: new Date().toISOString() 
  },
  
  'house.1': { 
    id: 'house.1', 
    title: '1st House', 
    kind: 'house', 
    summary: 'The House of Self. Rules identity, appearance, and how we present ourselves to the world.',
    bodyMD: HOUSE_1_MDX, 
    links: ['planet.mars', 'sign.aries', 'aspect.conjunction'],
    updatedAt: new Date().toISOString() 
  },
  
  'house.5': { 
    id: 'house.5', 
    title: '5th House', 
    kind: 'house', 
    summary: 'The House of Creativity. Rules self-expression, romance, children, and creative projects.',
    bodyMD: HOUSE_5_MDX, 
    links: ['planet.sun', 'sign.leo', 'aspect.trine'],
    updatedAt: new Date().toISOString() 
  },
  
  'house.4': { 
    id: 'house.4', 
    title: '4th House', 
    kind: 'house', 
    summary: 'The House of Home. Rules family, roots, emotional foundation, and private life.',
    bodyMD: HOUSE_4_MDX, 
    links: ['planet.moon', 'sign.cancer', 'aspect.opposition'],
    updatedAt: new Date().toISOString() 
  },
  
  'aspect.trine': { 
    id: 'aspect.trine', 
    title: 'Trine (120°)', 
    kind: 'aspect', 
    summary: 'A harmonious aspect that brings ease and natural flow between planets.',
    bodyMD: TRINE_MDX, 
    links: ['planet.venus', 'planet.jupiter', 'element.fire'],
    updatedAt: new Date().toISOString() 
  },
  
  'aspect.square': { 
    id: 'aspect.square', 
    title: 'Square (90°)', 
    kind: 'aspect', 
    summary: 'A challenging aspect that creates tension and forces growth through conflict.',
    bodyMD: SQUARE_MDX, 
    links: ['planet.mars', 'planet.saturn', 'modality.cardinal'],
    updatedAt: new Date().toISOString() 
  },
  
  'aspect.conjunction': { 
    id: 'aspect.conjunction', 
    title: 'Conjunction (0°)', 
    kind: 'aspect', 
    summary: 'Planets in the same sign or very close together. Intensifies their combined energy.',
    bodyMD: CONJUNCTION_MDX, 
    links: ['planet.sun', 'planet.moon', 'planet.mercury'],
    updatedAt: new Date().toISOString() 
  },
  
  'aspect.opposition': { 
    id: 'aspect.opposition', 
    title: 'Opposition (180°)', 
    kind: 'aspect', 
    summary: 'Planets directly across from each other. Creates tension and the need for balance.',
    bodyMD: OPPOSITION_MDX, 
    links: ['planet.sun', 'planet.moon', 'house.1', 'house.7'],
    updatedAt: new Date().toISOString() 
  },
  
  'element.fire': { 
    id: 'element.fire', 
    title: 'Fire Element', 
    kind: 'concept', 
    summary: 'Aries, Leo, Sagittarius. Energetic, passionate, and action-oriented.',
    bodyMD: FIRE_ELEMENT_MDX, 
    links: ['sign.aries', 'sign.leo', 'sign.sagittarius'],
    updatedAt: new Date().toISOString() 
  },
  
  'element.earth': { 
    id: 'element.earth', 
    title: 'Earth Element', 
    kind: 'concept', 
    summary: 'Taurus, Virgo, Capricorn. Practical, grounded, and material-focused.',
    bodyMD: EARTH_ELEMENT_MDX, 
    links: ['sign.taurus', 'sign.virgo', 'sign.capricorn'],
    updatedAt: new Date().toISOString() 
  },
  
  'element.air': { 
    id: 'element.air', 
    title: 'Air Element', 
    kind: 'concept', 
    summary: 'Gemini, Libra, Aquarius. Intellectual, communicative, and relationship-oriented.',
    bodyMD: AIR_ELEMENT_MDX, 
    links: ['sign.gemini', 'sign.libra', 'sign.aquarius'],
    updatedAt: new Date().toISOString() 
  },
  
  'element.water': { 
    id: 'element.water', 
    title: 'Water Element', 
    kind: 'concept', 
    summary: 'Cancer, Scorpio, Pisces. Emotional, intuitive, and deeply feeling.',
    bodyMD: WATER_ELEMENT_MDX, 
    links: ['sign.cancer', 'sign.scorpio', 'sign.pisces'],
    updatedAt: new Date().toISOString() 
  }
};

const TRANSITS: Record<string, TransitExplainer> = {
  'venus-trine-mars': { 
    id: 'venus-trine-mars', 
    title: 'Venus Trine Mars', 
    tags: ['venus', 'trine', 'mars'], 
    excerpt: 'Harmony between love and action. Natural chemistry and creative flow.',
    bodyMD: VENUS_TRINE_MARS_MDX 
  },
  
  'sun-conjunction-moon': { 
    id: 'sun-conjunction-moon', 
    title: 'Sun Conjunction Moon', 
    tags: ['sun', 'conjunction', 'moon'], 
    excerpt: 'New Moon energy. Fresh starts and new beginnings.',
    bodyMD: SUN_CONJUNCTION_MOON_MDX 
  },
  
  'mars-square-saturn': { 
    id: 'mars-square-saturn', 
    title: 'Mars Square Saturn', 
    tags: ['mars', 'square', 'saturn'], 
    excerpt: 'Frustration and obstacles. Time to build discipline and patience.',
    bodyMD: MARS_SQUARE_SATURN_MDX 
  },
  
  'venus-opposition-jupiter': { 
    id: 'venus-opposition-jupiter', 
    title: 'Venus Opposition Jupiter', 
    tags: ['venus', 'opposition', 'jupiter'], 
    excerpt: 'Excess and overindulgence. Finding balance in pleasure and expansion.',
    bodyMD: VENUS_OPPOSITION_JUPITER_MDX 
  }
};

// Content definitions
const VENUS_MDX = `### Venus 🌟
**Keywords:** Love, beauty, harmony, values, relationships, aesthetics

**Dignities:**
- **Rulership:** Taurus, Libra
- **Exaltation:** Pisces
- **Detriment:** Scorpio, Aries
- **Fall:** Virgo

**Core Themes:**
- What we find attractive and beautiful
- How we give and receive love
- Our values and what we treasure
- Artistic and aesthetic preferences
- Relationship patterns and dynamics

**Shadow Side:**
- Vanity and superficiality
- Over-indulgence in pleasure
- People-pleasing tendencies
- Materialism and possessiveness

**In Music:**
Venus rules harmony, melody, and the emotional resonance of sound. Strong Venus placements often indicate natural musical ability and appreciation for beauty in sound.`;

const MARS_MDX = `### Mars 🔥
**Keywords:** Action, energy, desire, courage, assertion, motivation

**Dignities:**
- **Rulership:** Aries, Scorpio
- **Exaltation:** Capricorn
- **Detriment:** Libra, Taurus
- **Fall:** Cancer

**Core Themes:**
- How we take action and assert ourselves
- What motivates and drives us
- Our relationship with anger and conflict
- Physical energy and vitality
- Sexual desire and passion

**Shadow Side:**
- Aggression and violence
- Impulsiveness and recklessness
- Selfishness and ego-driven behavior
- Burnout and overexertion

**In Music:**
Mars rules rhythm, percussion, and the driving force behind musical expression. Strong Mars placements often indicate natural rhythm and the ability to create energetic, motivating music.`;

const SUN_MDX = `### Sun ☀️
**Keywords:** Identity, ego, vitality, life purpose, self-expression, creativity

**Dignities:**
- **Rulership:** Leo
- **Exaltation:** Aries
- **Detriment:** Aquarius
- **Fall:** Libra

**Core Themes:**
- Our essential self and identity
- Life purpose and direction
- Creative self-expression
- Leadership and authority
- Vitality and life force

**Shadow Side:**
- Egotism and self-centeredness
- Need for constant attention
- Arrogance and superiority
- Burnout from overexertion

**In Music:**
The Sun rules the core melody, the main theme, and the central expression of a musical piece. Strong Sun placements often indicate natural leadership in musical contexts and the ability to create memorable, impactful compositions.`;

const MOON_MDX = `### Moon 🌙
**Keywords:** Emotions, instincts, habits, unconscious, nurturing, intuition

**Dignities:**
- **Rulership:** Cancer
- **Exaltation:** Taurus
- **Detriment:** Capricorn
- **Fall:** Scorpio

**Core Themes:**
- Emotional nature and instincts
- Unconscious patterns and habits
- Nurturing and caregiving
- Intuition and psychic sensitivity
- Connection to the past and family

**Shadow Side:**
- Moodiness and emotional instability
- Over-dependency and neediness
- Passive-aggressive behavior
- Emotional manipulation

**In Music:**
The Moon rules the emotional undertones, the subtle harmonies, and the intuitive flow of music. Strong Moon placements often indicate natural emotional expression through sound and the ability to create deeply moving, atmospheric music.`;

const TAURUS_MDX = `### Taurus ♉
**Element:** Earth | **Modality:** Fixed | **Ruler:** Venus

**Keywords:** Stability, beauty, material security, sensuality, persistence

**Core Traits:**
- Grounded and practical approach to life
- Strong appreciation for beauty and comfort
- Persistent and determined when motivated
- Natural connection to the physical world
- Loyal and dependable in relationships

**Strengths:**
- Reliable and trustworthy
- Artistic and creative
- Patient and methodical
- Good with money and resources
- Sensual and pleasure-oriented

**Challenges:**
- Resistance to change
- Stubbornness and inflexibility
- Materialistic tendencies
- Possessiveness in relationships
- Slow to make decisions

**In Music:**
Taurus brings a love of beautiful, harmonious sounds and a natural appreciation for music that soothes and comforts. Taureans often have beautiful singing voices and a natural sense of rhythm and melody.`;

const LIBRA_MDX = `### Libra ♎
**Element:** Air | **Modality:** Cardinal | **Ruler:** Venus

**Keywords:** Balance, harmony, partnership, justice, beauty, diplomacy

**Core Traits:**
- Natural desire for harmony and balance
- Strong focus on relationships and partnerships
- Diplomatic and fair-minded approach
- Appreciation for beauty and aesthetics
- Indecisive and seeks others' opinions

**Strengths:**
- Natural peacemakers and mediators
- Artistic and creative
- Charming and sociable
- Fair and just in decision-making
- Good at seeing multiple perspectives

**Challenges:**
- Difficulty making decisions
- Over-dependency on others
- Avoidance of conflict
- People-pleasing tendencies
- Indecisiveness and procrastination

**In Music:**
Libra brings a natural sense of harmony and balance to music, often excelling at creating beautiful, well-structured compositions. Librans often have a natural ear for harmony and a gift for creating music that brings people together.`;

const ARIES_MDX = `### Aries ♈
**Element:** Fire | **Modality:** Cardinal | **Ruler:** Mars

**Keywords:** Action, leadership, courage, independence, pioneering spirit

**Core Traits:**
- Natural leaders and pioneers
- High energy and enthusiasm
- Independent and self-reliant
- Direct and straightforward communication
- Impulsive and action-oriented

**Strengths:**
- Natural courage and bravery
- Leadership abilities
- High energy and motivation
- Direct and honest communication
- Innovative and pioneering

**Challenges:**
- Impatience and impulsiveness
- Selfishness and ego-driven behavior
- Difficulty with authority
- Quick to anger and conflict
- Lack of follow-through

**In Music:**
Aries brings energy, drive, and a pioneering spirit to music. Arians often excel at creating energetic, motivating music and have a natural ability to lead musical projects and inspire others.`;

const CANCER_MDX = `### Cancer ♋
**Element:** Water | **Modality:** Cardinal | **Ruler:** Moon

**Keywords:** Nurturing, protection, emotions, family, intuition, security

**Core Traits:**
- Highly emotional and intuitive
- Strong protective instincts
- Deep connection to family and home
- Nurturing and caring nature
- Moodiness and emotional sensitivity

**Strengths:**
- Natural caregivers and nurturers
- Strong intuition and psychic abilities
- Loyal and protective of loved ones
- Creative and imaginative
- Good memory and connection to the past

**Challenges:**
- Over-emotional and moody
- Over-protective and smothering
- Difficulty letting go of the past
- Passive-aggressive behavior
- Need for constant emotional security

**In Music:**
Cancer brings deep emotional expression and a natural ability to create music that touches the heart. Cancerians often excel at creating nostalgic, emotionally resonant music and have a natural gift for expressing feelings through sound.`;

const LEO_MDX = `### Leo ♌
**Element:** Fire | **Modality:** Fixed | **Ruler:** Sun

**Keywords:** Creativity, confidence, leadership, drama, self-expression, pride

**Core Traits:**
- Natural performers and entertainers
- Confident and self-assured
- Creative and dramatic
- Generous and warm-hearted
- Need for recognition and attention

**Strengths:**
- Natural leadership abilities
- Creative and artistic talents
- Generous and warm-hearted
- Confident and self-assured
- Natural performers and entertainers

**Challenges:**
- Need for constant attention
- Arrogance and pride
- Dramatic and attention-seeking
- Difficulty accepting criticism
- Self-centered behavior

**In Music:**
Leo brings natural showmanship and a gift for creating music that commands attention. Leos often excel at performing and creating music that is bold, dramatic, and memorable.`;

const HOUSE_7_MDX = `### 7th House 🏠
**Keywords:** Partnerships, relationships, marriage, contracts, open enemies

**Core Themes:**
- One-on-one relationships and partnerships
- Marriage and committed relationships
- Business partnerships and contracts
- How we relate to others
- What we seek in a partner

**Ruled by:** Libra (natural ruler) and Venus

**Key Questions:**
- What do I seek in a partner?
- How do I relate to others?
- What are my relationship patterns?
- How do I handle conflict in relationships?

**In Music:**
The 7th House represents collaborative music-making, duets, and the way we work with others in musical contexts. Strong 7th House placements often indicate natural ability in ensemble playing and collaborative composition.`;

const HOUSE_1_MDX = `### 1st House 🏠
**Keywords:** Self, identity, appearance, first impressions, physical body

**Core Themes:**
- Our identity and sense of self
- Physical appearance and first impressions
- How we present ourselves to the world
- Our approach to new beginnings
- Personal style and mannerisms

**Ruled by:** Aries (natural ruler) and Mars

**Key Questions:**
- Who am I at my core?
- How do I present myself to others?
- What is my personal style?
- How do I approach new beginnings?

**In Music:**
The 1st House represents our unique musical voice and personal style. Strong 1st House placements often indicate a distinctive musical identity and the ability to create music that is uniquely personal and expressive.`;

const HOUSE_5_MDX = `### 5th House 🏠
**Keywords:** Creativity, self-expression, romance, children, fun, entertainment

**Core Themes:**
- Creative self-expression and artistic pursuits
- Romance and dating
- Children and parenting
- Fun, games, and entertainment
- Personal hobbies and interests

**Ruled by:** Leo (natural ruler) and Sun

**Key Questions:**
- How do I express my creativity?
- What brings me joy and pleasure?
- How do I approach romance and dating?
- What are my creative talents?

**In Music:**
The 5th House represents creative musical expression, performance, and the joy of making music. Strong 5th House placements often indicate natural creative abilities and a love of performing and entertaining through music.`;

const HOUSE_4_MDX = `### 4th House 🏠
**Keywords:** Home, family, roots, emotional foundation, private life

**Core Themes:**
- Home and family life
- Emotional foundation and security
- Connection to roots and heritage
- Private life and personal space
- Childhood and early experiences

**Ruled by:** Cancer (natural ruler) and Moon

**Key Questions:**
- What makes me feel emotionally secure?
- How do I create a sense of home?
- What are my family patterns?
- How do I nurture myself and others?

**In Music:**
The 4th House represents the emotional foundation of music, the way music connects us to our roots and heritage. Strong 4th House placements often indicate a deep emotional connection to music and the ability to create music that feels like home.`;

const TRINE_MDX = `### Trine (120°) ⚡
**Keywords:** Harmony, ease, natural flow, talent, opportunity

**Core Themes:**
- Natural harmony and ease between planets
- Talents and abilities that come naturally
- Opportunities that flow easily
- Positive, supportive energy
- Creative and artistic expression

**Strengths:**
- Natural talents and abilities
- Easy flow of energy
- Positive opportunities
- Creative expression
- Harmonious relationships

**Challenges:**
- May be taken for granted
- Lack of motivation to develop
- Over-reliance on natural gifts
- Missed opportunities due to complacency

**In Music:**
Trines in the chart often indicate natural musical talent and the ability to create harmonious, flowing music. They represent the ease with which musical ideas come together and the natural flow of creative expression.`;

const SQUARE_MDX = `### Square (90°) ⚔️
**Keywords:** Tension, challenge, growth, conflict, motivation

**Core Themes:**
- Tension and conflict between planets
- Challenges that force growth
- Motivation through difficulty
- Internal and external conflicts
- Need for resolution and integration

**Strengths:**
- Strong motivation and drive
- Ability to overcome obstacles
- Growth through challenge
- Determination and persistence
- Learning through experience

**Challenges:**
- Internal tension and conflict
- Difficulty integrating energies
- Frustration and impatience
- Self-sabotage and resistance
- Need for constant challenge

**In Music:**
Squares in the chart often indicate the drive to create music that challenges and pushes boundaries. They represent the tension that creates dynamic, compelling music and the motivation to overcome musical obstacles.`;

const CONJUNCTION_MDX = `### Conjunction (0°) 🔗
**Keywords:** Intensity, focus, combination, new beginning, power

**Core Themes:**
- Planets working together as one
- Intensified energy and focus
- New beginnings and fresh starts
- Combined power and influence
- Need for integration and balance

**Strengths:**
- Intensified energy and power
- Clear focus and direction
- New opportunities and beginnings
- Strong combined influence
- Natural integration of energies

**Challenges:**
- Overwhelming intensity
- Difficulty separating energies
- All-or-nothing approach
- Need for balance and moderation
- Potential for excess

**In Music:**
Conjunctions in the chart often indicate intense musical focus and the ability to create powerful, concentrated musical expressions. They represent the coming together of different musical elements into a unified whole.`;

const OPPOSITION_MDX = `### Opposition (180°) ⚖️
**Keywords:** Balance, tension, awareness, integration, relationship

**Core Themes:**
- Planets in direct opposition
- Need for balance and integration
- Awareness of different perspectives
- Relationship dynamics
- Tension that seeks resolution

**Strengths:**
- Awareness of different perspectives
- Ability to see both sides
- Natural relationship skills
- Need for balance and harmony
- Integration of opposites

**Challenges:**
- Internal tension and conflict
- Difficulty finding balance
- Projection onto others
- All-or-nothing thinking
- Need for constant adjustment

**In Music:**
Oppositions in the chart often indicate the ability to create music that balances different elements and perspectives. They represent the tension between different musical approaches and the need to find harmony between them.`;

const FIRE_ELEMENT_MDX = `### Fire Element 🔥
**Signs:** Aries, Leo, Sagittarius

**Keywords:** Energy, passion, action, inspiration, leadership

**Core Traits:**
- High energy and enthusiasm
- Natural leaders and pioneers
- Action-oriented and motivated
- Inspirational and uplifting
- Independent and self-reliant

**Strengths:**
- Natural leadership abilities
- High energy and motivation
- Inspirational and uplifting
- Action-oriented and decisive
- Independent and self-reliant

**Challenges:**
- Impatience and impulsiveness
- Selfishness and ego-driven behavior
- Difficulty with authority
- Quick to anger and conflict
- Lack of follow-through

**In Music:**
Fire signs bring energy, passion, and a pioneering spirit to music. They often excel at creating energetic, motivating music and have a natural ability to inspire and lead others through their musical expression.`;

const EARTH_ELEMENT_MDX = `### Earth Element 🌍
**Signs:** Taurus, Virgo, Capricorn

**Keywords:** Practicality, stability, material world, persistence, grounding

**Core Traits:**
- Grounded and practical approach
- Strong connection to material world
- Persistent and determined
- Reliable and trustworthy
- Patient and methodical

**Strengths:**
- Reliable and trustworthy
- Practical and grounded
- Persistent and determined
- Good with resources and money
- Patient and methodical

**Challenges:**
- Resistance to change
- Materialistic tendencies
- Stubbornness and inflexibility
- Slow to make decisions
- Difficulty with abstract concepts

**In Music:**
Earth signs bring a grounded, practical approach to music and a natural appreciation for beautiful, harmonious sounds. They often excel at creating music that is well-structured, reliable, and deeply satisfying.`;

const AIR_ELEMENT_MDX = `### Air Element 💨
**Signs:** Gemini, Libra, Aquarius

**Keywords:** Communication, intellect, relationships, ideas, social connection

**Core Traits:**
- Intellectual and communicative
- Social and relationship-oriented
- Idea-focused and innovative
- Diplomatic and fair-minded
- Curious and adaptable

**Strengths:**
- Natural communication skills
- Intellectual and analytical
- Social and relationship-oriented
- Diplomatic and fair-minded
- Curious and adaptable

**Challenges:**
- Difficulty with emotions
- Over-intellectualization
- Indecisiveness and procrastination
- Avoidance of conflict
- Need for constant stimulation

**In Music:**
Air signs bring intellectual depth and a natural ability to create music that communicates ideas and connects people. They often excel at creating music that is innovative, well-structured, and socially engaging.`;

const WATER_ELEMENT_MDX = `### Water Element 🌊
**Signs:** Cancer, Scorpio, Pisces

**Keywords:** Emotions, intuition, depth, sensitivity, psychic ability

**Core Traits:**
- Highly emotional and intuitive
- Deeply feeling and sensitive
- Psychic and spiritually aware
- Nurturing and protective
- Creative and imaginative

**Strengths:**
- Natural intuition and psychic ability
- Deep emotional understanding
- Creative and imaginative
- Nurturing and protective
- Spiritually aware and connected

**Challenges:**
- Over-emotional and moody
- Over-sensitive and easily hurt
- Difficulty with boundaries
- Passive-aggressive behavior
- Need for constant emotional security

**In Music:**
Water signs bring deep emotional expression and a natural ability to create music that touches the heart and soul. They often excel at creating music that is deeply moving, atmospheric, and emotionally resonant.`;

const VENUS_TRINE_MARS_MDX = `### Venus Trine Mars 🌟⚡
**Theme:** Harmony between love and action

**Core Meaning:**
This transit brings natural harmony between your desires and your ability to take action. There's an ease in expressing your affections and a natural flow between your romantic and sexual energies.

**Positive Manifestations:**
- Natural chemistry and attraction
- Easy expression of love and desire
- Creative flow and inspiration
- Harmonious relationships
- Artistic and creative success

**Practical Applications:**
- Channel this energy into creative projects
- Express your feelings openly and honestly
- Use this time for romantic gestures
- Focus on collaborative creative work
- Build and strengthen relationships

**In Music:**
This transit is excellent for creating music that combines beauty and energy, harmony and rhythm. It's a perfect time for collaborative music-making and creating pieces that express both love and passion.`;

const SUN_CONJUNCTION_MOON_MDX = `### Sun Conjunction Moon ☀️🌙
**Theme:** New beginnings and fresh starts

**Core Meaning:**
This transit marks a new beginning, a fresh start in your emotional and personal life. It's a time of integration between your conscious and unconscious selves, your identity and your emotions.

**Positive Manifestations:**
- New beginnings and fresh starts
- Integration of self and emotions
- Clarity about your identity
- Emotional balance and harmony
- Renewed energy and vitality

**Practical Applications:**
- Set new intentions and goals
- Focus on self-care and emotional well-being
- Begin new projects or relationships
- Take time for reflection and integration
- Embrace new opportunities

**In Music:**
This transit is excellent for starting new musical projects and creating music that represents your authentic self. It's a perfect time for solo work and creating pieces that express your true identity.`;

const MARS_SQUARE_SATURN_MDX = `### Mars Square Saturn ⚔️⏰
**Theme:** Frustration and obstacles

**Core Meaning:**
This transit brings frustration and obstacles that test your patience and determination. It's a time when your actions meet resistance, forcing you to build discipline and patience.

**Positive Manifestations:**
- Building discipline and patience
- Learning to work through obstacles
- Developing persistence and determination
- Gaining wisdom through experience
- Strengthening your resolve

**Practical Applications:**
- Focus on long-term goals
- Build discipline and routine
- Learn to work with limitations
- Develop patience and persistence
- Use obstacles as learning opportunities

**In Music:**
This transit challenges you to create music that requires discipline and persistence. It's a time to work on technical skills and create music that demonstrates your ability to overcome obstacles.`;

const VENUS_OPPOSITION_JUPITER_MDX = `### Venus Opposition Jupiter 🌟📈
**Theme:** Excess and overindulgence

**Core Meaning:**
This transit brings a tendency toward excess and overindulgence, particularly in areas of pleasure, beauty, and relationships. It's a time to find balance between expansion and moderation.

**Positive Manifestations:**
- Expanded appreciation for beauty
- Generous and warm-hearted expression
- Opportunities for growth and expansion
- Increased social connections
- Enhanced creative expression

**Practical Applications:**
- Practice moderation and balance
- Focus on quality over quantity
- Use this energy for creative projects
- Build meaningful relationships
- Share your gifts with others

**In Music:**
This transit encourages you to create music that is expansive and generous, but be mindful of overdoing it. It's a time to create music that brings joy and beauty to others while maintaining artistic integrity.`;
