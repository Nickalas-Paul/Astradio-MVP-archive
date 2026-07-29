/**
 * Encounter obstacle pools — one per house.
 * Encounter builder selects deterministically per calendar date.
 * Gemini receives the name, type, and brief to build the scene around.
 *
 * Types: creature | rival | puzzle | trap | hazard
 */

export interface ObstacleEntry {
  name: string;
  type: 'creature' | 'rival' | 'puzzle' | 'trap' | 'hazard';
  brief: string;
}

export const OBSTACLE_POOLS: Record<number, ObstacleEntry[]> = {
  // ── House 1: The Identity Forge (Self) ──
  1: [
    { name: 'The Mirror Warden', type: 'creature', brief: 'A shifting construct that mimics your movements, testing whether you can act beyond reflex.' },
    { name: 'The False Foundation', type: 'trap', brief: 'The ground rearranges itself beneath you, forcing you to find footing on unstable ground.' },
    { name: 'The Echo of What You Were', type: 'rival', brief: 'A projection of an earlier version of yourself, slower but familiar with every pattern you rely on.' },
    { name: 'The Crucible Lock', type: 'puzzle', brief: 'A mechanism that opens only when you apply pressure to the part of yourself you guard most.' },
    { name: 'The Shedding Threshold', type: 'hazard', brief: 'A narrowing passage that strips away anything carried out of habit rather than need.' },
    { name: 'The Unnamed Shape', type: 'creature', brief: 'Something formless that solidifies only when you name what you are afraid to become.' },
  ],

  // ── House 2: The Vault of Substance (Resources / Values) ──
  2: [
    { name: 'The Hoard Sentinel', type: 'creature', brief: 'A dense, armored guardian that tests whether you can distinguish need from attachment.' },
    { name: 'The Weighted Scale', type: 'puzzle', brief: 'A balance mechanism that locks until you surrender something of value to proceed.' },
    { name: 'The Scarcity Spiral', type: 'trap', brief: 'The room contracts around your resources, pressuring hasty decisions about what to keep.' },
    { name: "The Collector's Ghost", type: 'rival', brief: 'A figure who already possesses what you need, offering trades that cost more than they appear.' },
    { name: 'The Erosion Current', type: 'hazard', brief: 'A slow dissolving force that wears at anything you carry too tightly.' },
    { name: 'The Root Worm', type: 'creature', brief: 'A burrowing entity that feeds on stored potential, growing stronger the more you hoard.' },
  ],

  // ── House 3: The Signal Maze (Communication) ──
  3: [
    { name: 'The Cipher Wraith', type: 'creature', brief: 'A being made of scrambled language that distorts every message passing through it.' },
    { name: 'The Broken Relay', type: 'puzzle', brief: 'A communication chain with missing links that must be bridged with precision.' },
    { name: 'The Misquote Trap', type: 'trap', brief: 'Your own words return to you altered, and the corridor reshapes based on the distortion.' },
    { name: 'The Static Herald', type: 'rival', brief: 'A messenger who delivers competing instructions, each sounding equally urgent.' },
    { name: 'The Feedback Loop', type: 'hazard', brief: 'An escalating echo that amplifies every statement until the noise becomes physical.' },
    { name: 'The Translation Gate', type: 'puzzle', brief: 'A barrier that opens only when you find the right language for something you have been saying wrong.' },
  ],

  // ── House 4: The Ancestral Basement (Home / Foundation) ──
  4: [
    { name: 'The Foundation Crack', type: 'hazard', brief: 'A widening fracture in the ground that deepens when you stand still too long.' },
    { name: 'The Hearthbound', type: 'creature', brief: 'A territorial presence that defends the old arrangement of the space, resisting any change.' },
    { name: 'The Inheritance Lock', type: 'puzzle', brief: 'A sealed chamber that opens only when you acknowledge what you received and what you rejected.' },
    { name: 'The Comfort Snare', type: 'trap', brief: 'A space so familiar and warm it drains your will to move forward.' },
    { name: 'The Rootless Shade', type: 'rival', brief: 'A figure with no ground of its own that tries to claim yours.' },
    { name: 'The Memory Wall', type: 'hazard', brief: 'A barrier built from compacted history that softens only when you stop pushing.' },
  ],

  // ── House 5: The Crucible Stage (Creativity / Play) ──
  5: [
    { name: 'The Spotlight Beast', type: 'creature', brief: 'A predator that feeds on hesitation, growing larger the longer you wait in the wings.' },
    { name: 'The Unfinished Work', type: 'puzzle', brief: 'A creation left mid-stroke that destabilizes the room until someone completes or destroys it.' },
    { name: 'The Mockery Mirror', type: 'trap', brief: 'A surface that reflects your efforts back as parody, testing whether you can keep creating anyway.' },
    { name: 'The Rival Performer', type: 'rival', brief: 'Another artist working the same material, whose version threatens to replace yours.' },
    { name: 'The Joy Drain', type: 'hazard', brief: 'An ambient dampening that turns every act of play into labor.' },
    { name: 'The Muse Parasite', type: 'creature', brief: 'An entity that offers brilliant inspiration at the cost of your original voice.' },
  ],

  // ── House 6: The Precision Engine (Service / Health / Routine) ──
  6: [
    { name: 'The Gear Misalignment', type: 'puzzle', brief: 'A mechanism slightly out of sync that cascades into larger dysfunction if left uncorrected.' },
    { name: 'The Overwork Shade', type: 'creature', brief: 'A tireless replica of you that keeps producing, making your own pace feel insufficient.' },
    { name: 'The Tolerance Trap', type: 'trap', brief: 'A slowly worsening condition that feels manageable until it is not.' },
    { name: 'The Efficiency Rival', type: 'rival', brief: 'A figure who does your work faster but strips all care from the process.' },
    { name: 'The Contamination Bloom', type: 'hazard', brief: 'A spreading impurity that requires careful, patient containment.' },
    { name: 'The Triage Gate', type: 'puzzle', brief: 'Three problems present simultaneously, but only one can be addressed. The others will worsen.' },
  ],

  // ── House 7: The Mirror Court (Partnership / Others) ──
  7: [
    { name: 'The Projection Knight', type: 'creature', brief: 'An armored figure wearing a familiar face that fights with grievances you did not know existed.' },
    { name: 'The Contract Paradox', type: 'puzzle', brief: 'An agreement where both sides are right and both sides lose unless the terms are rewritten.' },
    { name: 'The Accommodation Trap', type: 'trap', brief: 'A space that reshapes itself to someone else\'s comfort while slowly crushing yours.' },
    { name: 'The Shadow Negotiator', type: 'rival', brief: 'A mediator who appears fair but consistently tilts outcomes away from you.' },
    { name: 'The Boundary Erosion', type: 'hazard', brief: 'A slow dissolving of the line between your space and someone else\'s.' },
    { name: 'The Empty Chair', type: 'puzzle', brief: 'A conversation that must be completed with someone who is not present.' },
  ],

  // ── House 8: The Descent (Transformation / Shared Resources) ──
  8: [
    { name: 'The Threshold Guardian', type: 'creature', brief: 'A massive presence blocking the way down that cannot be fought, only surrendered to.' },
    { name: 'The Debt Calculus', type: 'puzzle', brief: 'An accounting of what you owe and what is owed to you that will not balance until something is released.' },
    { name: 'The Intimacy Trap', type: 'trap', brief: 'A bond that deepens faster than trust can follow, creating vulnerability without safety.' },
    { name: 'The Power Broker', type: 'rival', brief: 'A figure who controls access to what you need and names a price in something you cannot easily give.' },
    { name: 'The Molting Corridor', type: 'hazard', brief: 'A passage that requires shedding protection to fit through.' },
    { name: 'The Buried Truth', type: 'puzzle', brief: 'Something hidden beneath layers that resists excavation and reshapes itself when exposed.' },
  ],

  // ── House 9: The Pilgrim's Ascent (Philosophy / Expansion) ──
  9: [
    { name: 'The Doctrine Wall', type: 'hazard', brief: 'A barrier made of crystallized belief that cracks only under questions it has not encountered.' },
    { name: 'The False Guide', type: 'rival', brief: 'A teacher who knows the terrain but leads toward their destination, not yours.' },
    { name: 'The Horizon Puzzle', type: 'puzzle', brief: 'A path that extends infinitely unless you define where "enough" is.' },
    { name: 'The Certitude Beast', type: 'creature', brief: 'A creature that grows stronger the more certain you are, weakening only when you hold doubt.' },
    { name: 'The Translation Trap', type: 'trap', brief: 'A foreign framework that almost fits your experience but distorts the parts that matter most.' },
    { name: 'The Altitude Sickness', type: 'hazard', brief: 'The thinning of everything familiar as you climb higher than your previous understanding allowed.' },
  ],

  // ── House 10: The Authority Spire (Career / Public Role) ──
  10: [
    { name: 'The Reputation Golem', type: 'creature', brief: 'A construct made from other people\'s perception of you that acts independently of your intentions.' },
    { name: 'The Credential Gate', type: 'puzzle', brief: 'A checkpoint that demands proof of competence in a form you do not carry.' },
    { name: 'The Exposure Trap', type: 'trap', brief: 'A position of visibility where every action is watched and every mistake is recorded.' },
    { name: 'The Title Rival', type: 'rival', brief: 'Someone who holds the position you are approaching and has no intention of making room.' },
    { name: 'The Structural Erosion', type: 'hazard', brief: 'The slow weakening of a system you have been building on, forcing adaptation mid-climb.' },
    { name: 'The Legacy Lock', type: 'puzzle', brief: 'A door that opens based on what you have built, not what you intend to build.' },
  ],

  // ── House 11: The Network Labyrinth (Community / Future Vision) ──
  11: [
    { name: 'The Disconnection Phantom', type: 'creature', brief: 'An entity that severs links between allies, isolating each node in the network.' },
    { name: 'The Consensus Trap', type: 'trap', brief: 'A decision point where agreement comes at the cost of the idea that started the conversation.' },
    { name: 'The Signal Scrambler', type: 'rival', brief: 'A presence that introduces noise into group communication, making coordination unreliable.' },
    { name: 'The Broken Node', type: 'puzzle', brief: 'A critical junction in the network that failed, rerouting everything through less stable paths.' },
    { name: 'The Groupthink Fog', type: 'hazard', brief: 'A dampening field that makes every individual perspective sound like dissent.' },
    { name: 'The Obsolescence Wave', type: 'hazard', brief: 'A sweeping update that threatens to leave your contribution behind if you do not adapt.' },
  ],

  // ── House 12: The Dissolution Chamber (Unconscious / Surrender) ──
  12: [
    { name: 'The Drain Entity', type: 'creature', brief: 'A formless presence that feeds on resistance, growing weaker only when you stop fighting.' },
    { name: 'The Lost Archive', type: 'puzzle', brief: 'A scattered collection of fragments from your past that must be assembled without forcing a narrative.' },
    { name: 'The Compassion Trap', type: 'trap', brief: 'A call to save something that cannot be saved, testing whether you can grieve instead of rescue.' },
    { name: 'The Saboteur Within', type: 'rival', brief: 'A part of yourself that undermines your progress for reasons you cannot fully articulate.' },
    { name: 'The Dissolving Floor', type: 'hazard', brief: 'Ground that softens under certainty and firms under acceptance.' },
    { name: 'The Final Mask', type: 'puzzle', brief: 'The last identity you are holding onto that does not fit but feels too dangerous to remove.' },
  ],
};
