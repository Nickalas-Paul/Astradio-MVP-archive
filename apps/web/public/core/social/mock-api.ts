// Mock Social API
// Self-contained mock services for community features

import type { 
  User, 
  Circle, 
  LibraryItem, 
  Playlist, 
  Favorite, 
  Session, 
  UserActivity,
  LibraryStats 
} from './types';

export const SocialAPI = {
  async me(): Promise<User> { 
    return MOCK.me; 
  },

  async friends(): Promise<User[]> { 
    return MOCK.friends; 
  },

  async circles(): Promise<Circle[]> { 
    return MOCK.circles; 
  },

  async circleMembers(id: string): Promise<User[]> {
    const c = MOCK.circles.find(x => x.id === id);
    return (c?.memberIds || []).map(id => MOCK.users[id]).filter(Boolean);
  },

  async createCircle(name: string): Promise<Circle> {
    const id = `c_${Math.random().toString(36).slice(2)}`;
    const circle: Circle = { 
      id, 
      name, 
      ownerId: MOCK.me.id, 
      memberIds: [MOCK.me.id], 
      createdAt: new Date().toISOString() 
    };
    MOCK.circles.push(circle);
    return circle;
  },

  async library(userId?: string): Promise<LibraryItem[]> {
    return MOCK.library[userId || MOCK.me.id] || [];
  },

  async addToLibrary(item: LibraryItem, userId?: string): Promise<void> {
    const uid = userId || MOCK.me.id;
    if (!MOCK.library[uid]) MOCK.library[uid] = [];
    MOCK.library[uid].push(item);
  },

  async playlists(): Promise<Playlist[]> { 
    return MOCK.playlists; 
  },

  async upsertPlaylist(p: Playlist): Promise<Playlist> { 
    upsert(MOCK.playlists, p); 
    return p; 
  },

  async favorites(): Promise<Favorite[]> { 
    return MOCK.favorites; 
  },

  async toggleFavorite(itemId: string, itemType: LibraryItem['t']): Promise<boolean> {
    const i = MOCK.favorites.findIndex(f => 
      f.itemId === itemId && f.itemType === itemType && f.userId === MOCK.me.id
    );
    if (i >= 0) { 
      MOCK.favorites.splice(i, 1); 
      return false; 
    }
    MOCK.favorites.push({ 
      userId: MOCK.me.id, 
      itemId, 
      itemType, 
      createdAt: new Date().toISOString() 
    }); 
    return true;
  },

  async sessions(): Promise<Session[]> { 
    return MOCK.sessions; 
  },

  async createSession(title: string, circleId?: string): Promise<Session> {
    const s: Session = {
      id: `s_${Math.random().toString(36).slice(2)}`, 
      hostId: MOCK.me.id, 
      title, 
      circleId,
      queue: MOCK.seedQueue.slice(0, 5), 
      currentIndex: 0, 
      participants: [MOCK.me.id], 
      createdAt: new Date().toISOString()
    };
    MOCK.sessions.unshift(s);
    return s;
  },

  async joinSession(id: string): Promise<void> {
    const s = MOCK.sessions.find(x => x.id === id);
    if (s && !s.participants.includes(MOCK.me.id)) {
      s.participants.push(MOCK.me.id);
    }
  },

  async leaveSession(id: string): Promise<void> {
    const s = MOCK.sessions.find(x => x.id === id);
    if (s) {
      s.participants = s.participants.filter(p => p !== MOCK.me.id);
    }
  },

  async nextTrack(id: string): Promise<void> {
    const s = MOCK.sessions.find(x => x.id === id);
    if (!s) return;
    s.currentIndex = Math.min(s.queue.length - 1, s.currentIndex + 1);
  },

  async previousTrack(id: string): Promise<void> {
    const s = MOCK.sessions.find(x => x.id === id);
    if (!s) return;
    s.currentIndex = Math.max(0, s.currentIndex - 1);
  },

  async getLibraryStats(userId?: string): Promise<LibraryStats> {
    const uid = userId || MOCK.me.id;
    const items = MOCK.library[uid] || [];
    
    return {
      totalItems: items.length,
      compositions: items.filter(i => i.t === 'composition').length,
      pairs: items.filter(i => i.t === 'pair').length,
      charts: items.filter(i => i.t === 'chart').length,
      playlists: MOCK.playlists.filter(p => p.ownerId === uid).length,
      favorites: MOCK.favorites.filter(f => f.userId === uid).length,
      recentActivity: MOCK.activities.filter(a => a.userId === uid).slice(0, 10)
    };
  },

  async getUserActivity(userId?: string): Promise<UserActivity[]> {
    const uid = userId || MOCK.me.id;
    return MOCK.activities.filter(a => a.userId === uid);
  },

  async addActivity(activity: Omit<UserActivity, 'id' | 'timestamp'>): Promise<void> {
    const newActivity: UserActivity = {
      ...activity,
      id: `act_${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString()
    };
    MOCK.activities.unshift(newActivity);
    // Keep only last 100 activities
    MOCK.activities = MOCK.activities.slice(0, 100);
  }
};

// Minimal in-memory store
const MOCK = {
  me: { 
    id: 'u_me', 
    handle: '@you', 
    displayName: 'You', 
    visibility: 'public' as const,
    bio: 'Exploring cosmic harmonies through music'
  } as User,
  
  users: {
    'u_me': { 
      id: 'u_me', 
      handle: '@you', 
      displayName: 'You', 
      visibility: 'public' as const,
      bio: 'Exploring cosmic harmonies through music'
    },
    'u_1': { 
      id: 'u_1', 
      handle: '@astro_dj', 
      displayName: 'AstroDJ', 
      visibility: 'public' as const,
      bio: 'House music meets cosmic energy',
      avatarUrl: '/avatars/astro-dj.jpg'
    },
    'u_2': { 
      id: 'u_2', 
      handle: '@moon_beats', 
      displayName: 'MoonBeats', 
      visibility: 'public' as const,
      bio: 'Ambient soundscapes from lunar cycles',
      avatarUrl: '/avatars/moon-beats.jpg'
    },
    'u_3': { 
      id: 'u_3', 
      handle: '@star_sax', 
      displayName: 'StarSax', 
      visibility: 'friends' as const,
      bio: 'Jazz improvisation meets stellar patterns',
      avatarUrl: '/avatars/star-sax.jpg'
    }
  } as Record<string, User>,
  
  friends: [
    { 
      id: 'u_1', 
      handle: '@astro_dj', 
      displayName: 'AstroDJ', 
      visibility: 'public' as const,
      bio: 'House music meets cosmic energy',
      avatarUrl: '/avatars/astro-dj.jpg'
    },
    { 
      id: 'u_2', 
      handle: '@moon_beats', 
      displayName: 'MoonBeats', 
      visibility: 'public' as const,
      bio: 'Ambient soundscapes from lunar cycles',
      avatarUrl: '/avatars/moon-beats.jpg'
    }
  ] as User[],
  
  circles: [
    {
      id: 'c_1',
      name: 'Cosmic House Collective',
      ownerId: 'u_1',
      memberIds: ['u_1', 'u_me'],
      inviteCode: 'COSMIC2024',
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 'c_2',
      name: 'Lunar Ambient Society',
      ownerId: 'u_2',
      memberIds: ['u_2', 'u_me', 'u_3'],
      inviteCode: 'LUNAR2024',
      createdAt: new Date(Date.now() - 172800000).toISOString()
    }
  ] as Circle[],
  
  library: {
    'u_me': [
      { t: 'composition', id: 'cmp_1', title: 'My Cosmic Dawn', genre: 'ambient', durationSec: 60, previewUrl: '/audio/cosmic_dawn.mp3' },
      { t: 'composition', id: 'cmp_2', title: 'House of Stars', genre: 'house', durationSec: 60, previewUrl: '/audio/house_stars.mp3' },
      { t: 'pair', id: 'pair_1', chartA: 'natal-1', chartB: 'today-1', label: 'My Natal × Today' },
      { t: 'chart', id: 'natal-1', label: 'My Natal Chart' }
    ] as LibraryItem[],
    'u_1': [
      { t: 'composition', id: 'cmp_3', title: 'Venus Rising', genre: 'house', durationSec: 60, previewUrl: '/audio/venus_rising.mp3' },
      { t: 'composition', id: 'cmp_4', title: 'Mars Energy', genre: 'electronic', durationSec: 60, previewUrl: '/audio/mars_energy.mp3' }
    ] as LibraryItem[],
    'u_2': [
      { t: 'composition', id: 'cmp_5', title: 'Lunar Phases', genre: 'ambient', durationSec: 60, previewUrl: '/audio/lunar_phases.mp3' },
      { t: 'composition', id: 'cmp_6', title: 'Moonlight Sonata', genre: 'classical', durationSec: 60, previewUrl: '/audio/moonlight_sonata.mp3' }
    ] as LibraryItem[]
  } as Record<string, LibraryItem[]>,
  
  playlists: [
    {
      id: 'pl_1',
      ownerId: 'u_me',
      title: 'My Favorites',
      items: [
        { t: 'composition', id: 'cmp_1', title: 'My Cosmic Dawn', genre: 'ambient', durationSec: 60, previewUrl: '/audio/cosmic_dawn.mp3' },
        { t: 'composition', id: 'cmp_2', title: 'House of Stars', genre: 'house', durationSec: 60, previewUrl: '/audio/house_stars.mp3' }
      ],
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 'pl_2',
      ownerId: 'u_me',
      title: 'Cosmic House Vibes',
      items: [
        { t: 'composition', id: 'cmp_3', title: 'Venus Rising', genre: 'house', durationSec: 60, previewUrl: '/audio/venus_rising.mp3' },
        { t: 'composition', id: 'cmp_4', title: 'Mars Energy', genre: 'electronic', durationSec: 60, previewUrl: '/audio/mars_energy.mp3' }
      ],
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 43200000).toISOString()
    }
  ] as Playlist[],
  
  favorites: [
    { userId: 'u_me', itemId: 'cmp_1', itemType: 'composition', createdAt: new Date(Date.now() - 86400000).toISOString() },
    { userId: 'u_me', itemId: 'cmp_3', itemType: 'composition', createdAt: new Date(Date.now() - 172800000).toISOString() },
    { userId: 'u_me', itemId: 'pair_1', itemType: 'pair', createdAt: new Date(Date.now() - 259200000).toISOString() }
  ] as Favorite[],
  
  sessions: [
    {
      id: 's_1',
      hostId: 'u_1',
      title: 'Cosmic House Session',
      circleId: 'c_1',
      queue: [
        { t: 'composition', id: 'cmp_3', title: 'Venus Rising', genre: 'house', durationSec: 60, previewUrl: '/audio/venus_rising.mp3' },
        { t: 'composition', id: 'cmp_4', title: 'Mars Energy', genre: 'electronic', durationSec: 60, previewUrl: '/audio/mars_energy.mp3' }
      ],
      currentIndex: 0,
      participants: ['u_1', 'u_me'],
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 's_2',
      hostId: 'u_2',
      title: 'Lunar Ambient Journey',
      circleId: 'c_2',
      queue: [
        { t: 'composition', id: 'cmp_5', title: 'Lunar Phases', genre: 'ambient', durationSec: 60, previewUrl: '/audio/lunar_phases.mp3' },
        { t: 'composition', id: 'cmp_6', title: 'Moonlight Sonata', genre: 'classical', durationSec: 60, previewUrl: '/audio/moonlight_sonata.mp3' }
      ],
      currentIndex: 1,
      participants: ['u_2', 'u_me', 'u_3'],
      createdAt: new Date(Date.now() - 7200000).toISOString()
    }
  ] as Session[],
  
  activities: [
    { id: 'act_1', userId: 'u_me', type: 'composition', itemId: 'cmp_1', itemType: 'composition', timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: 'act_2', userId: 'u_me', type: 'session_join', itemId: 's_1', timestamp: new Date(Date.now() - 7200000).toISOString() },
    { id: 'act_3', userId: 'u_me', type: 'favorite', itemId: 'cmp_3', itemType: 'composition', timestamp: new Date(Date.now() - 86400000).toISOString() }
  ] as UserActivity[],
  
  seedQueue: [
    { t: 'composition', id: 'cmp_demo_1', title: 'Lo-Fi Dawn', genre: 'lofi', durationSec: 60, previewUrl: '/audio/lofi_demo.mp3' },
    { t: 'composition', id: 'cmp_demo_2', title: 'House Night', genre: 'house', durationSec: 60, previewUrl: '/audio/house_demo.mp3' },
    { t: 'composition', id: 'cmp_demo_3', title: 'Jazz Constellation', genre: 'jazz', durationSec: 60, previewUrl: '/audio/jazz_demo.mp3' },
    { t: 'composition', id: 'cmp_demo_4', title: 'Electronic Pulse', genre: 'electronic', durationSec: 60, previewUrl: '/audio/electronic_demo.mp3' },
    { t: 'composition', id: 'cmp_demo_5', title: 'Classical Moon', genre: 'classical', durationSec: 60, previewUrl: '/audio/classical_demo.mp3' }
  ] as LibraryItem[]
};

function upsert<T extends { id: string }>(arr: T[], obj: T): void {
  const i = arr.findIndex(x => x.id === obj.id);
  if (i >= 0) arr[i] = obj;
  else arr.push(obj);
}
