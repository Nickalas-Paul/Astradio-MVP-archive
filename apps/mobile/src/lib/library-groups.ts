export type LibrarySourceGroup =
  | 'identity'
  | 'transits'
  | 'sky'
  | 'connections'
  | 'forecasts'
  | 'community'
  | 'sandbox';

export interface LibraryGroup<T extends MobileLibraryItem = MobileLibraryItem> {
  key: LibrarySourceGroup;
  label: string;
  emptyMessage: string;
  rows: T[];
}

export type MobileLibraryItem = {
  id: string;
  title: string;
  subtitle: string;
  hasAudio: boolean;
  exportId?: string | null;
  source?: string;
};

const GROUP_CONFIG: {
  key: LibrarySourceGroup;
  label: string;
  sources: string[];
  emptyMessage: string;
}[] = [
  {
    key: 'identity',
    label: 'Identity',
    sources: ['profile_identity'],
    emptyMessage: 'Your identity soundtrack lives on My Sky.',
  },
  {
    key: 'transits',
    label: 'Transits',
    sources: ['profile_active'],
    emptyMessage: 'Save a transit from Today to start your collection.',
  },
  {
    key: 'sky',
    label: "Today's Sky",
    sources: ['sky'],
    emptyMessage: "Hear Today's Sky and save it to keep a daily snapshot.",
  },
  {
    key: 'connections',
    label: 'Connections',
    sources: ['community_relationship', 'community_group'],
    emptyMessage: 'Connect with someone to create your first shared reading.',
  },
  {
    key: 'forecasts',
    label: 'Forecasts',
    sources: ['community_relational_weather'],
    emptyMessage: 'Expand a weather forecast on Today and save it.',
  },
  {
    key: 'community',
    label: 'Community',
    sources: ['community_post_audio'],
    emptyMessage: 'Save audio from community posts.',
  },
  {
    key: 'sandbox',
    label: 'Sandbox',
    sources: ['sandbox'],
    emptyMessage: 'Compose in the Sandbox and save your experiments.',
  },
];

export function groupLibraryRows<T extends MobileLibraryItem>(rows: T[]): LibraryGroup<T>[] {
  return GROUP_CONFIG.map((config) => ({
    key: config.key,
    label: config.label,
    emptyMessage: config.emptyMessage,
    rows: rows.filter((r) => config.sources.includes(String(r.source ?? ''))),
  }));
}
