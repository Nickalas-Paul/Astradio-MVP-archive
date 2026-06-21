import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TodaySkeleton } from '../../src/components/today/TodaySkeleton';
import { TodaySkyWheel } from '../../src/components/today/TodaySkyWheel';
import { TodayTransitWheel } from '../../src/components/today/TodayTransitWheel';
import { AUTH_HORIZONTAL_PADDING } from '../../src/constants/auth-styles';
import { colors } from '../../src/constants/colors';
import { planetColor } from '../../src/constants/planet-colors';
import { useTodayData } from '../../src/hooks/useTodayData';
import { api } from '../../src/lib/api';
import { formatApiError } from '../../src/lib/format-api-error';
import {
  buildSkyComposeRequestBody,
  exportIdFromComposePayload,
} from '../../src/lib/today-mappers';
import { useAudioStore } from '../../src/store/audio';
import { useAuthStore } from '../../src/store/auth';
import { MarkdownText } from '../../src/components/shared/MarkdownText';
import { PlanetText } from '../../src/components/shared/PlanetText';
import {
  ACTIVATION_HEAT_COLORS,
  activationHeatLabel,
} from '../../src/lib/activation-heat';
import type {
  ActiveStateResponse,
  TodayRelationalWeatherCard,
  TodayRelationalWeatherLine,
} from '../../src/types/today';

function formatTodayDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function SectionDivider() {
  return <View style={styles.sectionDivider} />;
}

function SectionHeading({ title }: { title: string }) {
  return <Text style={styles.sectionHeading}>{title}</Text>;
}

function SectionBridge({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.bridge}>
      <View style={styles.bridgeLine} />
      <Text style={styles.bridgeTitle}>{title}</Text>
      <Text style={styles.bridgeSubtitle}>{subtitle}</Text>
    </View>
  );
}

function ActivationProgressBar({
  value,
  heatLevel,
}: {
  value: number;
  heatLevel: TodayRelationalWeatherCard['heatLevel'];
}) {
  const heat = ACTIVATION_HEAT_COLORS[heatLevel];
  return (
    <View style={styles.progressTrack} accessibilityElementsHidden>
      <View
        style={[
          styles.progressFill,
          { width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: heat.bar },
        ]}
      />
    </View>
  );
}

function ActivationLineRow({ line }: { line: TodayRelationalWeatherLine }) {
  const accentColor = line.transitPlanet ? planetColor(line.transitPlanet) : colors.text.muted;
  const headline = line.prefix.trim();

  return (
    <View style={styles.weatherLine}>
      <Text style={styles.weatherLabel}>{line.label}</Text>
      {headline ? (
        <View style={styles.activationHeadlineRow}>
          <View style={[styles.planetDot, { backgroundColor: accentColor ?? colors.text.muted }]} />
          <PlanetText tone="secondary" style={styles.activationHeadline}>
            {headline}
          </PlanetText>
        </View>
      ) : null}
      <View style={styles.activationBodyRow}>
        {!headline ? (
          <View style={[styles.planetDot, { backgroundColor: accentColor ?? colors.text.muted }]} />
        ) : null}
        <View style={styles.activationBodyText}>
          <MarkdownText>{line.description}</MarkdownText>
        </View>
      </View>
    </View>
  );
}

function RelationalWeatherCard({ weather }: { weather: TodayRelationalWeatherCard }) {
  const heat = ACTIVATION_HEAT_COLORS[weather.heatLevel];

  return (
    <View
      style={[
        styles.weatherCard,
        {
          borderLeftColor: heat.border,
          backgroundColor: heat.cardTint ?? colors.surface,
        },
      ]}
    >
      <View style={styles.weatherHeader}>
        <Text style={[styles.transitTitle, styles.weatherConnectionName]}>
          {weather.connectionName}
        </Text>
        <Text style={[styles.heatLabel, { color: heat.label }]}>
          {activationHeatLabel(weather.heatLevel)}
        </Text>
      </View>
      {weather.microTag ? <Text style={styles.microTag}>{weather.microTag}</Text> : null}
      <ActivationProgressBar value={weather.activationEffective} heatLevel={weather.heatLevel} />
      {weather.lines.map((line) => (
        <ActivationLineRow key={`${weather.id}-${line.role}`} line={line} />
      ))}
    </View>
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const playTrack = useAudioStore((state) => state.playTrack);
  const { data, isLoading, error, refetch } = useTodayData();
  const [refreshing, setRefreshing] = useState(false);
  const [skyAudioLoading, setSkyAudioLoading] = useState(false);
  const [skyAudioError, setSkyAudioError] = useState<string | null>(null);
  const [transitAudioLoading, setTransitAudioLoading] = useState(false);
  const [transitAudioError, setTransitAudioError] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleHearTodaysSky = useCallback(async () => {
    if (!data?.composeContext) return;
    setSkyAudioLoading(true);
    setSkyAudioError(null);
    try {
      const { date, time, location } = data.composeContext;
      const payload = await api<Record<string, unknown>>('/api/compose', {
        method: 'POST',
        body: JSON.stringify(buildSkyComposeRequestBody(date, time, location, true)),
      });
      const exportId = exportIdFromComposePayload(payload);
      if (!exportId) {
        setSkyAudioError('Could not compose sky audio');
        return;
      }
      playTrack({ exportId, label: "Today's Sky", source: 'sky' });
    } catch (err) {
      setSkyAudioError(formatApiError(err, 'Could not compose sky audio'));
    } finally {
      setSkyAudioLoading(false);
    }
  }, [data?.composeContext, playTrack]);

  const handleHearYourTransit = useCallback(async () => {
    if (!data?.composeContext) return;
    if (!data.transitHashes) {
      setTransitAudioError('Compose a transit report first, then compose audio.');
      return;
    }
    setTransitAudioLoading(true);
    setTransitAudioError(null);
    try {
      const { chartId, date, time, location } = data.composeContext;
      const { expectedPlanSha256, expectedObjectIdentityHash } = data.transitHashes;
      const body = {
        chartId,
        calendarDate: date,
        localTime: time.length === 5 ? time : time.slice(0, 5),
        location,
        generateAudio: true,
        expectedPlanSha256,
        expectedObjectIdentityHash,
      };
      let payload: ActiveStateResponse;
      try {
        payload = await api<ActiveStateResponse>('/api/profile/active-state', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      } catch {
        if (!userId) throw new Error('Could not compose transit audio');
        payload = await api<ActiveStateResponse>('/api/profile/active-state', {
          method: 'POST',
          body: JSON.stringify({ ...body, userId }),
        });
      }
      const exportId = exportIdFromComposePayload(payload as Record<string, unknown>);
      if (!exportId) {
        setTransitAudioError('Could not compose transit audio');
        return;
      }
      playTrack({ exportId, label: 'Your Transit', source: 'transit' });
    } catch (err) {
      setTransitAudioError(formatApiError(err, 'Could not compose transit audio'));
    } finally {
      setTransitAudioLoading(false);
    }
  }, [data?.composeContext, data?.transitHashes, playTrack, userId]);

  const handleSignOut = async () => {
    await logout();
    router.replace('/welcome');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.accent.DEFAULT}
            colors={[colors.accent.DEFAULT]}
          />
        }
      >
        <Text style={styles.title}>Today</Text>
        <Text style={styles.date}>{formatTodayDate()}</Text>

        {isLoading && !data ? <TodaySkeleton /> : null}

        {error && !data ? (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void refetch()}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {data ? (
          <>
            {data.skySummary || data.skySnapshot ? (
              <>
                <SectionDivider />
                <SectionHeading title="Right Now in the Sky" />
                <TodaySkyWheel snapshot={data.skySnapshot} />
                {data.skySummary ? (
                  <View style={styles.card}>
                    <MarkdownText tone="primary">{data.skySummary}</MarkdownText>
                  </View>
                ) : null}
                {data.composeContext ? (
                  <View style={styles.audioCtaBlock}>
                    <Pressable
                      onPress={() => void handleHearTodaysSky()}
                      disabled={skyAudioLoading}
                      style={({ pressed }) => [
                        styles.audioButton,
                        pressed && styles.audioButtonPressed,
                        skyAudioLoading && styles.audioButtonDisabled,
                      ]}
                    >
                      <Text style={styles.audioButtonText}>
                        {skyAudioLoading ? 'Composing...' : "Hear Today's Sky"}
                      </Text>
                    </Pressable>
                    {skyAudioError ? <Text style={styles.audioError}>{skyAudioError}</Text> : null}
                  </View>
                ) : null}
              </>
            ) : null}

            <SectionBridge
              title="Your chart"
              subtitle="That's the weather for everyone. Here's how it's landing on your chart."
            />

            <SectionDivider />
            <SectionHeading title="Your Transit" />
            <TodayTransitWheel
              natalSnapshot={data.natalSnapshot}
              transitSnapshot={data.transitSnapshot}
            />
            {data.transits.length === 0 ? (
              <Text style={styles.emptyText}>No active transits today</Text>
            ) : (
              data.transits.map((transit) => (
                <View key={transit.id} style={styles.transitCard}>
                  <PlanetText tone="primary" defaultColor={colors.text.primary} style={styles.transitTitle}>
                    {transit.title}
                  </PlanetText>
                  <MarkdownText>{transit.description}</MarkdownText>
                  {transit.metadata ? (
                    <Text style={styles.metadata}>{transit.metadata}</Text>
                  ) : null}
                </View>
              ))
            )}

            {data.composeContext ? (
              <View style={styles.audioCtaBlock}>
                <Pressable
                  onPress={() => void handleHearYourTransit()}
                  disabled={transitAudioLoading}
                  style={({ pressed }) => [
                    styles.audioButton,
                    pressed && styles.audioButtonPressed,
                    transitAudioLoading && styles.audioButtonDisabled,
                  ]}
                >
                  <Text style={styles.audioButtonText}>
                    {transitAudioLoading ? 'Composing...' : 'Hear Your Transit'}
                  </Text>
                </Pressable>
                {transitAudioError ? <Text style={styles.audioError}>{transitAudioError}</Text> : null}
              </View>
            ) : null}

            {data.relationalWeather.length > 0 ? (
              <>
                <SectionBridge
                  title="Your connections"
                  subtitle="Now zoom out. Here's how today's sky is activating your connections."
                />
                <SectionDivider />
                <SectionHeading title="Relational Weather" />
                {data.relationalWeather.map((weather) => (
                  <RelationalWeatherCard key={weather.id} weather={weather} />
                ))}
              </>
            ) : null}
          </>
        ) : null}

        <Pressable onPress={() => void handleSignOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: AUTH_HORIZONTAL_PADDING,
    paddingBottom: 40,
  },
  title: {
    color: colors.text.primary,
    fontSize: 28,
    fontFamily: 'Cormorant-SemiBold',
    marginTop: 8,
  },
  date: {
    color: colors.accent.DEFAULT,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    marginTop: 4,
    marginBottom: 8,
  },
  sectionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 20,
    marginBottom: 16,
  },
  sectionHeading: {
    color: colors.accent.DEFAULT,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 12,
  },
  bridge: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  bridgeLine: {
    width: 48,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.accent.DEFAULT,
    marginBottom: 4,
  },
  bridgeTitle: {
    color: colors.accent.DEFAULT,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bridgeSubtitle: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
  },
  transitCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
  },
  weatherCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderLeftWidth: 2,
    padding: 16,
    marginBottom: 10,
  },
  transitTitle: {
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 6,
    flexShrink: 1,
  },
  weatherConnectionName: {
    color: colors.text.primary,
    marginBottom: 0,
  },
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  heatLabel: {
    fontSize: 11,
    fontFamily: 'Manrope-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  microTag: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Medium',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
    maxWidth: 200,
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  metadata: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    marginTop: 8,
  },
  weatherLine: {
    marginTop: 12,
  },
  weatherLabel: {
    color: colors.text.muted,
    fontSize: 11,
    fontFamily: 'Manrope-SemiBold',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  activationHeadlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  activationHeadline: {
    flex: 1,
  },
  activationBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  activationBodyText: {
    flex: 1,
  },
  planetDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    marginBottom: 16,
    paddingVertical: 12,
  },
  audioCtaBlock: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  audioButton: {
    minHeight: 48,
    minWidth: 200,
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioButtonPressed: {
    opacity: 0.85,
  },
  audioButtonDisabled: {
    opacity: 0.6,
  },
  audioButtonText: {
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
  },
  audioError: {
    color: colors.error,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    marginTop: 8,
    textAlign: 'center',
  },
  errorBlock: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  errorText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryText: {
    color: colors.accent.DEFAULT,
    fontSize: 14,
    fontFamily: 'Manrope-Medium',
  },
  signOutButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 40,
  },
  signOutText: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
});
