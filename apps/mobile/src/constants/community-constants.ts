export const FOUNDER_USER_ID = 'usr_ff0e0495d46e1846';

export const MAX_OUTGOING_CONNECTION_REQUESTS = 3;

export type RelationalIntent = 'friend' | 'lover';

export const RELATIONAL_INTENT_OPTIONS: { value: RelationalIntent; label: string }[] = [
  { value: 'friend', label: 'Friend' },
  { value: 'lover', label: 'Partner' },
];

export type CommunitySubTabId = 'discovery' | 'connections' | 'messages' | 'feed';

export const COMMUNITY_SUB_TABS: { id: CommunitySubTabId; label: string }[] = [
  { id: 'discovery', label: 'Discover' },
  { id: 'connections', label: 'Connect' },
  { id: 'messages', label: 'Messages' },
  { id: 'feed', label: 'Feed' },
];
