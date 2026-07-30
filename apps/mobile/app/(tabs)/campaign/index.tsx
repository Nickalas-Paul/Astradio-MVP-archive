import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../src/constants/colors';
import { getDungeonTheme } from '../../../src/lib/game/dungeon-themes';
import {
  createSoloCampaign,
  gameErrorMessage,
  isApiError,
  listCampaigns,
  resolveChapterLabel,
  type CampaignListItem,
} from '../../../src/lib/game-api';

function preview(campaign: CampaignListItem) {
  const state = campaign.stateJson;
  const hp =
    typeof state?.hp?.current === 'number' && typeof state.hp.max === 'number'
      ? `${state.hp.current}/${state.hp.max}`
      : '—';
  const house =
    state?.activeChapter?.currentHouse ?? state?.saturnChapter?.currentHouse ?? null;
  const dungeonTheme = getDungeonTheme(house);
  return {
    hp,
    streak: state?.streak ?? 0,
    chapter: state?.chapter ?? 1,
    dungeon: resolveChapterLabel(state) ?? dungeonTheme.label,
    domain: dungeonTheme.domain,
    accent: dungeonTheme.accent,
    accentMuted: dungeonTheme.accentMuted,
    textAccent: dungeonTheme.textAccent,
  };
}

export default function CampaignHubScreen() {
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [gateOff, setGateOff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    setGateOff(false);
    try {
      const result = await listCampaigns();
      const campaigns = Array.isArray(result.campaigns) ? result.campaigns : [];
      setCampaign(campaigns.find((item) => !item.mode || item.mode === 'solo') ?? campaigns[0] ?? null);
    } catch (err) {
      setCampaign(null);
      setGateOff(isApiError(err, 503));
      setError(gameErrorMessage(err, 'Could not load your campaign.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const begin = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const created = await createSoloCampaign();
      router.push({
        pathname: '/campaign/[campaignId]' as never,
        params: { campaignId: created.campaignId },
      });
    } catch (err) {
      setGateOff(isApiError(err, 503));
      setError(gameErrorMessage(err, 'Could not begin your campaign.'));
    } finally {
      setCreating(false);
    }
  }, [router]);

  const details = campaign ? preview(campaign) : null;
  const hubGradient: [string, string] = details
    ? getDungeonTheme(
        campaign?.stateJson?.activeChapter?.currentHouse ??
          campaign?.stateJson?.saturnChapter?.currentHouse ??
          1
      ).gradient
    : ['#0C1320', '#0C1320'];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient colors={hubGradient} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View
        pointerEvents="none"
        style={[
          styles.orbTop,
          details ? { backgroundColor: details.accentMuted } : null,
        ]}
      />
      <View pointerEvents="none" style={styles.orbBottom} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.accent.DEFAULT}
          />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-outline" size={26} color={colors.accent.DEFAULT} />
          </View>
          <Text style={styles.title}>Your Campaign</Text>
          <Text style={styles.subtitle}>The planets are testing you.</Text>
        </View>

        {loading ? (
          <View style={styles.card}>
            <ActivityIndicator color={colors.accent.DEFAULT} />
            <Text style={styles.muted}>Opening the dungeon gate…</Text>
          </View>
        ) : gateOff ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>The dungeon gate is closed</Text>
            <Text style={styles.body}>Campaign combat is offline for now. Check back soon.</Text>
          </View>
        ) : campaign && details ? (
          <View
            style={[
              styles.card,
              {
                borderColor: details.accentMuted,
                borderLeftWidth: 3,
                borderLeftColor: details.accent,
              },
            ]}
          >
            <Text style={[styles.eyebrow, { color: details.textAccent }]}>ACTIVE CAMPAIGN</Text>
            <Text style={styles.cardTitle}>Resume Campaign</Text>
            <Text style={[styles.dungeonLabel, { color: details.textAccent }]}>{details.dungeon}</Text>
            <Text style={styles.body}>
              Chapter {details.chapter} · {details.domain}
            </Text>
            <View style={styles.metrics}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>HP</Text>
                <Text style={styles.metricValue}>{details.hp}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>STREAK</Text>
                <Text style={styles.metricValue}>
                  {details.streak}
                  {details.streak >= 7 ? ' 🔥' : ''}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: details.accent },
                pressed && styles.pressed,
              ]}
              onPress={() =>
                router.push({
                  pathname: '/campaign/[campaignId]' as never,
                  params: {
                    campaignId: campaign.campaignId,
                    initialHouse: String(
                      campaign.stateJson?.activeChapter?.currentHouse ??
                        campaign.stateJson?.saturnChapter?.currentHouse ??
                        1
                    ),
                  },
                })
              }
            >
              <Text style={styles.primaryButtonText}>Resume Campaign</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Begin Solo Campaign</Text>
            <Text style={styles.body}>
              Your natal chart becomes your character. The sky becomes your dungeon.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={creating}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || creating) && styles.pressed,
              ]}
              onPress={() => void begin()}
            >
              {creating ? <ActivityIndicator color="#fff" /> : null}
              <Text style={styles.primaryButtonText}>
                {creating ? 'Building Character…' : 'Begin Solo Campaign'}
              </Text>
            </Pressable>
            <Text style={styles.requirement}>
              Requires a saved natal chart in My Sky.
            </Text>
          </View>
        )}

        {error && !gateOff ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0C1320' },
  content: { flexGrow: 1, padding: 20, paddingBottom: 110, justifyContent: 'center' },
  orbTop: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(14,150,150,0.08)',
    right: -100,
    top: -70,
  },
  orbBottom: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(0,103,79,0.08)',
    left: -100,
    bottom: 40,
  },
  hero: { alignItems: 'center', marginBottom: 34 },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,150,150,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(14,150,150,0.3)',
    marginBottom: 14,
  },
  title: { fontFamily: 'Cormorant-Bold', fontSize: 38, color: '#F8FAFC' },
  subtitle: {
    fontFamily: 'Manrope-Regular',
    fontSize: 15,
    color: '#94A3B8',
    marginTop: 4,
  },
  card: {
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  eyebrow: {
    fontFamily: 'Manrope-Bold',
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.accent.DEFAULT,
  },
  cardTitle: { fontFamily: 'Cormorant-Bold', fontSize: 26, color: '#F8FAFC' },
  dungeonLabel: {
    fontFamily: 'Cormorant-SemiBold',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  body: { fontFamily: 'Manrope-Regular', fontSize: 14, lineHeight: 21, color: '#CBD5E1' },
  muted: { fontFamily: 'Manrope-Regular', fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  metrics: { flexDirection: 'row', gap: 10, marginVertical: 4 },
  metric: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
  },
  metricLabel: { fontFamily: 'Manrope-Bold', fontSize: 9, letterSpacing: 1.2, color: '#64748B' },
  metricValue: { fontFamily: 'Manrope-Bold', fontSize: 18, color: '#E2E8F0', marginTop: 3 },
  primaryButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: colors.accent.DEFAULT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    marginTop: 5,
  },
  primaryButtonText: { fontFamily: 'Manrope-Bold', fontSize: 14, color: '#fff' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  requirement: {
    fontFamily: 'Manrope-Regular',
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  error: {
    fontFamily: 'Manrope-Regular',
    color: '#F87171',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
  },
});
