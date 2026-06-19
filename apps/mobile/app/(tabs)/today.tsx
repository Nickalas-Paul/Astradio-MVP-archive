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
import { TodayAudioPlayer } from '../../src/components/today/TodayAudioPlayer';
import { TodaySkeleton } from '../../src/components/today/TodaySkeleton';
import { AUTH_HORIZONTAL_PADDING } from '../../src/constants/auth-styles';
import { colors } from '../../src/constants/colors';
import { planetColor } from '../../src/constants/planet-colors';
import { useTodayData } from '../../src/hooks/useTodayData';
import { useAuthStore } from '../../src/store/auth';
import { MarkdownText } from '../../src/components/shared/MarkdownText';
import { PlanetText } from '../../src/components/shared/PlanetText';
import {
  ACTIVATION_HEAT_COLORS,
  activationHeatLabel,
} from '../../src/lib/activation-heat';
import type { TodayRelationalWeatherCard, TodayRelationalWeatherLine } from '../../src/types/today';

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
        <Text style={styles.transitTitle}>{weather.connectionName}</Text>
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
  const { data, isLoading, error, refetch } = useTodayData();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

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
            {data.skySummary ? (
              <>
                <SectionDivider />
                <SectionHeading title="Today's Sky" />
                <View style={styles.card}>
                  <MarkdownText tone="primary">{data.skySummary}</MarkdownText>
                </View>
              </>
            ) : null}

            <SectionDivider />
            <SectionHeading title="Active Transits" />
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

            {data.relationalWeather.length > 0 ? (
              <>
                <SectionDivider />
                <SectionHeading title="Relational Weather" />
                {data.relationalWeather.map((weather) => (
                  <RelationalWeatherCard key={weather.id} weather={weather} />
                ))}
              </>
            ) : null}

            {data.audioExportId ? (
              <>
                <SectionDivider />
                <SectionHeading title="Today's Soundtrack" />
                <TodayAudioPlayer exportId={data.audioExportId} />
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 8,
  },
  transitCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 8,
  },
  weatherCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderLeftWidth: 2,
    padding: 16,
    marginBottom: 8,
  },
  transitTitle: {
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 6,
    flexShrink: 1,
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
