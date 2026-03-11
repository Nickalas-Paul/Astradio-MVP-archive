export type CampaignMode = 'solo' | 'group';

export type GroupFormationMode = 'chosen' | 'routed';

export interface CampaignEntrySelection {
  userId: string;
  mode: CampaignMode;
  formationMode?: GroupFormationMode;
  /** When mode==='group' && formationMode==='chosen', explicit members including or excluding userId. */
  selectedMemberUserIds?: string[];
}

export interface NormalizedCampaignEntry {
  userId: string;
  mode: CampaignMode;
  formationMode: GroupFormationMode | null;
  /** For solo mode this is [userId]; for chosen this is the unique, sorted set; for routed it is [userId] only. */
  seedMemberUserIds: string[];
}

export function normalizeCampaignEntrySelection(
  sel: CampaignEntrySelection
): NormalizedCampaignEntry {
  if (!sel || typeof sel !== 'object') {
    throw new Error('CampaignEntrySelection required');
  }
  const { userId, mode, formationMode, selectedMemberUserIds } = sel;
  if (!userId || typeof userId !== 'string') {
    throw new Error('CampaignEntrySelection.userId required');
  }
  if (mode !== 'solo' && mode !== 'group') {
    throw new Error(`CampaignEntrySelection.mode must be 'solo' or 'group'`);
  }

  if (mode === 'solo') {
    return {
      userId,
      mode: 'solo',
      formationMode: null,
      seedMemberUserIds: [userId],
    };
  }

  // mode === 'group'
  if (formationMode !== 'chosen' && formationMode !== 'routed') {
    throw new Error(`CampaignEntrySelection.formationMode must be 'chosen' or 'routed' for group mode`);
  }

  if (formationMode === 'routed') {
    // Seed with just the initiating user; matching engine will add others deterministically.
    return {
      userId,
      mode: 'group',
      formationMode: 'routed',
      seedMemberUserIds: [userId],
    };
  }

  // formationMode === 'chosen'
  const membersRaw = Array.isArray(selectedMemberUserIds)
    ? selectedMemberUserIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  // Ensure initiating user is always present.
  if (!membersRaw.includes(userId)) {
    membersRaw.push(userId);
  }
  const seedMemberUserIds = Array.from(new Set(membersRaw)).sort();

  return {
    userId,
    mode: 'group',
    formationMode: 'chosen',
    seedMemberUserIds,
  };
}

