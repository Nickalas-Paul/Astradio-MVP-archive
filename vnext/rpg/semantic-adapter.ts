export interface CampaignIdentityTone {
  /** Broad temperament descriptor for copy (“steady”, “volatile”, etc.). */
  temperamentFlavor: 'steady' | 'volatile' | 'sensitive' | 'driven' | 'adaptive';
  /** High-level mood descriptor for scene framing. */
  narrativeMood: 'bright' | 'balanced' | 'somber';
  /** Symbolic setting emphasis for solo challenges. */
  settingEmphasis: 'inner_world' | 'relationships' | 'work_public' | 'home_foundations';
  /** Whether to prefer reflective vs. action-forward framing. */
  actionBias: 'reflective' | 'decisive' | 'mixed';
}
