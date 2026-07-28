import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import {
  fetchGameState,
  fetchLootTable,
  gameErrorMessage,
  type LootTableResponse,
} from '../../lib/game-api';
import {
  activeHouseFromState,
  completedHousesFromFlags,
  pickLootPreview,
  rarityColor,
} from '../../lib/game/codex-utils';
import { ALL_DUNGEON_HOUSES, DUNGEON_DESCRIPTIONS } from '../../lib/game/dungeon-descriptions';
import { getDungeonTheme } from '../../lib/game/dungeon-themes';

type Props = {
  campaignId: string;
  scrollHouse?: number;
};

export function DungeonCodexScreen({ campaignId, scrollHouse }: Props) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const houseOffsets = useRef<Partial<Record<number, number>>>({});
  const [state, setState] = useState<Awaited<ReturnType<typeof fetchGameState>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [lootTable, setLootTable] = useState<LootTableResponse | null>(null);
  const [lootLoading, setLootLoading] = useState(false);
  const [lootError, setLootError] = useState<string | null>(null);
  const [didScroll, setDidScroll] = useState(false);

  const activeHouse = activeHouseFromState(state);
  const completedHouses = useMemo(
    () => completedHousesFromFlags(state?.milestoneFlags),
    [state?.milestoneFlags]
  );
  const activeTheme = getDungeonTheme(activeHouse);
  const lootPreview = pickLootPreview(lootTable?.items, 4);

  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchGameState(campaignId);
      setState(next);
    } catch (err) {
      const msg = gameErrorMessage(err, 'Failed to load campaign state.');
      setError(msg);
      if (msg.toLowerCase().includes('503') || msg.toLowerCase().includes('gate')) {
        router.replace('/(tabs)/campaign' as never);
      }
    } finally {
      setLoading(false);
    }
  }, [campaignId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!campaignId || lootTable || lootLoading) return;
    setLootLoading(true);
    fetchLootTable(campaignId)
      .then(setLootTable)
      .catch((err) => setLootError(gameErrorMessage(err, 'Failed to load loot table.')))
      .finally(() => setLootLoading(false));
  }, [campaignId, lootTable, lootLoading]);

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const house of ALL_DUNGEON_HOUSES) {
        if (next[house] === undefined) next[house] = house === activeHouse;
      }
      const focus = scrollHouse ?? activeHouse;
      if (focus >= 1 && focus <= 12) next[focus] = true;
      return next;
    });
  }, [activeHouse, scrollHouse]);

  useEffect(() => {
    if (didScroll || loading) return;
    const target = scrollHouse ?? activeHouse;
    const y = houseOffsets.current[target];
    if (y == null) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      setDidScroll(true);
    }, 150);
    return () => clearTimeout(timer);
  }, [didScroll, loading, scrollHouse, activeHouse]);

  const toggleHouse = (house: number) => {
    setExpanded((prev) => ({ ...prev, [house]: !prev[house] }));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/campaign/[campaignId]' as never,
              params: { campaignId },
            })
          }
          style={styles.backLink}
        >
          <Ionicons name="chevron-back" size={16} color="#94A3B8" />
          <Text style={styles.backText}>Back to encounter</Text>
        </Pressable>

        <Text style={styles.title}>Dungeon Codex</Text>
        <Text style={styles.subtitle}>The twelve arenas your campaign moves through</Text>

        {loading && !state ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent.DEFAULT} />
            <Text style={styles.muted}>Loading campaign state…</Text>
          </View>
        ) : null}

        {error && !state ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.retry}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {state
          ? ALL_DUNGEON_HOUSES.map((house) => {
              const theme = getDungeonTheme(house);
              const copy = DUNGEON_DESCRIPTIONS[house]!;
              const isActive = house === activeHouse;
              const isCompleted = completedHouses.has(house);
              const isOpen = !!expanded[house];
              const showLoot = isActive && lootPreview.length > 0;

              return (
                <View
                  key={house}
                  onLayout={(event) => {
                    houseOffsets.current[house] = event.nativeEvent.layout.y;
                  }}
                  style={[
                    styles.card,
                    {
                      borderColor: isActive ? theme.accent : 'rgba(255,255,255,0.08)',
                      backgroundColor: isActive ? theme.accentMuted : 'rgba(255,255,255,0.02)',
                    },
                  ]}
                >
                  <Pressable onPress={() => toggleHouse(house)} style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.badgeRow}>
                        <Text style={styles.cardTitle}>{theme.label}</Text>
                        {isActive ? (
                          <Text style={[styles.hereBadge, { color: theme.textAccent, borderColor: theme.accent }]}>
                            YOU ARE HERE
                          </Text>
                        ) : null}
                        {isCompleted && !isActive ? (
                          <Text style={styles.doneBadge}>Completed</Text>
                        ) : null}
                      </View>
                      <Text style={styles.cardMeta}>
                        House {house} · {theme.domain}
                      </Text>
                      {!isOpen ? (
                        <Text numberOfLines={2} style={styles.cardTeaser}>
                          {copy.description}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.chevron}>{isOpen ? '▴' : '▾'}</Text>
                  </Pressable>

                  {isOpen ? (
                    <View style={styles.cardBody}>
                      <Text style={styles.description}>{copy.description}</Text>
                      <Text style={styles.sectionLabel}>WHAT TO EXPECT</Text>
                      {copy.whatToExpect.map((line) => (
                        <View key={line} style={styles.bulletRow}>
                          <View style={[styles.bullet, { backgroundColor: theme.textAccent }]} />
                          <Text style={styles.bulletText}>{line}</Text>
                        </View>
                      ))}
                      <Text style={styles.sectionLabel}>LOOT PREVIEW</Text>
                      {showLoot ? (
                        lootPreview.map((item) => (
                          <View key={item.slug} style={styles.lootRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.lootName}>{item.name}</Text>
                              <Text style={styles.lootMeta}>
                                {item.category}
                                {Object.entries(item.statModifiers || {})
                                  .filter(([, v]) => v)
                                  .map(([k, v]) => ` · +${v} ${k}`)
                                  .join('')}
                              </Text>
                            </View>
                            <Text style={[styles.rarity, { color: rarityColor(item.rarity) }]}>
                              {item.rarity}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.lootPlaceholder}>
                          {isActive && lootLoading
                            ? 'Loading loot table…'
                            : isActive && lootError
                              ? lootError
                              : 'Enter this dungeon to see available loot.'}
                        </Text>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })
          : null}

        {state ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/campaign/[campaignId]' as never,
                params: { campaignId },
              })
            }
            style={[styles.returnButton, { backgroundColor: activeTheme.accent }]}
          >
            <Text style={styles.returnText}>Return to encounter</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0C1320' },
  content: { padding: 18, paddingBottom: 40, gap: 12 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  backText: { fontFamily: 'Manrope-SemiBold', fontSize: 12, color: '#94A3B8' },
  title: { fontFamily: 'Cormorant-Bold', fontSize: 32, color: '#F8FAFC' },
  subtitle: { fontFamily: 'Manrope-Regular', fontSize: 13, color: '#94A3B8', marginBottom: 8 },
  center: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  muted: { fontFamily: 'Manrope-Regular', fontSize: 13, color: '#94A3B8' },
  errorCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    gap: 10,
  },
  errorText: { fontFamily: 'Manrope-Regular', fontSize: 13, color: '#F87171' },
  retry: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  retryText: { fontFamily: 'Manrope-SemiBold', fontSize: 12, color: '#CBD5E1' },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 14 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  cardTitle: { fontFamily: 'Cormorant-SemiBold', fontSize: 18, color: '#F8FAFC' },
  hereBadge: {
    fontFamily: 'Manrope-Bold',
    fontSize: 8,
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  doneBadge: {
    fontFamily: 'Manrope-Bold',
    fontSize: 8,
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#64748B',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cardMeta: { fontFamily: 'Manrope-Regular', fontSize: 11, color: '#64748B', marginTop: 2 },
  cardTeaser: { fontFamily: 'Manrope-Regular', fontSize: 12, lineHeight: 18, color: '#94A3B8', marginTop: 8 },
  chevron: { fontSize: 14, color: '#64748B', marginTop: 4 },
  cardBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)', padding: 14, gap: 10 },
  description: { fontFamily: 'Cormorant-Regular', fontSize: 17, lineHeight: 24, color: '#E2E8F0' },
  sectionLabel: { fontFamily: 'Manrope-Bold', fontSize: 9, letterSpacing: 1.3, color: '#64748B', marginTop: 4 },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bullet: { width: 4, height: 4, borderRadius: 2, marginTop: 7 },
  bulletText: { flex: 1, fontFamily: 'Manrope-Regular', fontSize: 12, lineHeight: 18, color: '#94A3B8' },
  lootRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  lootName: { fontFamily: 'Cormorant-SemiBold', fontSize: 14, color: '#F8FAFC' },
  lootMeta: { fontFamily: 'Manrope-Regular', fontSize: 9, color: '#64748B', textTransform: 'capitalize' },
  rarity: { fontFamily: 'Manrope-Bold', fontSize: 8, textTransform: 'uppercase' },
  lootPlaceholder: { fontFamily: 'Manrope-Regular', fontSize: 12, fontStyle: 'italic', color: '#64748B' },
  returnButton: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  returnText: { fontFamily: 'Manrope-Bold', fontSize: 14, color: '#0C1320' },
});
