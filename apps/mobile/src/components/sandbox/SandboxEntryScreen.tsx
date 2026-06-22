import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AUTH_HORIZONTAL_PADDING } from '../../constants/auth-styles';
import { colors } from '../../constants/colors';
import { layout } from '../../constants/layout';
import { typography } from '../../constants/typography';
import {
  SANDBOX_ENTRY_CARDS,
  SANDBOX_HERO_SUBTITLE,
} from '../../constants/sandbox-entry-cards';
import { HISTORICAL_PRESETS, type HistoricalPreset } from '../../data/historical-presets';
import { incrementSandboxVisitCount } from '../../lib/ftue-storage';
import { SandboxJourneyIcon } from './SandboxJourneyIcon';
import { compositionHasExistingData } from '../../lib/sandbox-slot-utils';
import { useSandboxData } from '../../hooks/useSandboxData';
import { useSandboxStore } from '../../store/sandbox';
import type { SandboxJourneyType } from '../../types/sandbox';

function formatSavedDate(iso: string | undefined): string {
  if (!iso) return 'Saved composition';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Saved composition';
  return d.toLocaleString();
}

function JourneyCard({
  card,
  showHints,
  onStart,
}: {
  card: (typeof SANDBOX_ENTRY_CARDS)[number];
  showHints: boolean;
  onStart: () => void;
}) {
  const [hintVisible, setHintVisible] = useState(false);

  useEffect(() => {
    if (!showHints) {
      setHintVisible(false);
      return undefined;
    }
    const frame = requestAnimationFrame(() => setHintVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [showHints, card.id]);

  return (
    <View style={styles.journeyCard}>
      <SandboxJourneyIcon journey={card.id} />
      <Text style={styles.cardTitle}>{card.title}</Text>
      <Text style={styles.cardDescription}>{card.description}</Text>
      {showHints ? (
        <Text
          style={[
            styles.cardHint,
            { opacity: hintVisible ? 1 : 0 },
          ]}
        >
          {card.hint}
        </Text>
      ) : null}
      <Pressable style={styles.startButton} onPress={onStart} accessibilityRole="button">
        <Text style={styles.startButtonText}>Start</Text>
      </Pressable>
    </View>
  );
}

export function SandboxEntryScreen() {
  const selectJourney = useSandboxStore((s) => s.selectJourney);
  const continueWorkbench = useSandboxStore((s) => s.continueWorkbench);
  const slots = useSandboxStore((s) => s.slots);
  const resolveResult = useSandboxStore((s) => s.resolveResult);

  const { savedCompositions, loading, error, loadError, loadingCompositionId, loadComposition, refresh } =
    useSandboxData();

  const hasExisting = compositionHasExistingData({ slots, resolveResult });
  const [showHints, setShowHints] = useState(false);
  const visitsTrackedRef = useRef(false);

  useEffect(() => {
    if (visitsTrackedRef.current) return;
    visitsTrackedRef.current = true;
    void incrementSandboxVisitCount().then(({ showHints: next }) => setShowHints(next));
  }, []);

  const handlePresetSelect = (preset: HistoricalPreset) => {
    selectJourney('solo', { historicalPreset: preset });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.title}>Sandbox</Text>
          <Text style={styles.subtitle}>{SANDBOX_HERO_SUBTITLE}</Text>
        </View>

        {hasExisting ? (
          <Pressable onPress={continueWorkbench} style={styles.continueWrap} accessibilityRole="button">
            <Text style={styles.continueText}>
              You have a composition in progress.{' '}
              <Text style={styles.continueLink}>Continue where you left off →</Text>
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.cardGrid}>
          {SANDBOX_ENTRY_CARDS.map((card) => (
            <JourneyCard
              key={card.id}
              card={card}
              showHints={showHints}
              onStart={() => selectJourney(card.id as SandboxJourneyType)}
            />
          ))}
        </View>

        <View style={styles.historicalSection}>
          <Text style={styles.historicalTitle}>Historical Soundscapes</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetRow}
          >
            {HISTORICAL_PRESETS.map((preset) => (
              <Pressable
                key={preset.id}
                style={styles.presetPill}
                onPress={() => handlePresetSelect(preset)}
                accessibilityRole="button"
              >
                <Text style={styles.presetPillText}>{preset.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.savedSection}>
          <View style={styles.savedHeader}>
            <Text style={styles.savedTitle}>Saved</Text>
            <Pressable onPress={() => void refresh()} disabled={loading} accessibilityRole="button">
              <Text style={styles.refreshText}>{loading ? '…' : 'Refresh'}</Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

          {loading && savedCompositions.length === 0 ? (
            <ActivityIndicator color={colors.accent.DEFAULT} style={styles.loader} />
          ) : savedCompositions.length === 0 ? (
            <Text style={styles.emptyText}>No saved compositions yet.</Text>
          ) : (
            <View style={styles.savedList}>
              {savedCompositions.map((item) => {
                const busy = loadingCompositionId === item.id;
                return (
                  <View key={item.id} style={styles.savedRow}>
                    <Text style={styles.savedDate} numberOfLines={1}>
                      {formatSavedDate(item.created_at)}
                    </Text>
                    <Pressable
                      style={[styles.loadButton, busy && styles.loadButtonDisabled]}
                      disabled={busy}
                      onPress={() => void loadComposition(item.id)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.loadButtonText}>{busy ? '…' : 'Load'}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
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
    paddingBottom: layout.screenBottomPadding,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
  },
  title: {
    ...typography.screenTitle,
    color: colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: 16,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  continueWrap: {
    marginBottom: layout.sectionGap,
  },
  continueText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
  },
  continueLink: {
    color: colors.accent.DEFAULT,
    fontFamily: 'Manrope-Medium',
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: layout.cardGap,
    marginBottom: 28,
  },
  journeyCard: {
    width: '48%',
    flexGrow: 1,
    minHeight: 180,
    backgroundColor: layout.card.backgroundColor,
    borderWidth: layout.card.borderWidth,
    borderColor: layout.card.borderColor,
    borderRadius: layout.card.borderRadius,
    padding: layout.card.padding,
    alignItems: 'center',
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: 17,
    fontFamily: 'Cormorant-SemiBold',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardDescription: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    lineHeight: 17,
    flex: 1,
    marginBottom: 8,
    textAlign: 'center',
  },
  cardHint: {
    ...typography.hintText,
    color: colors.text.muted,
    lineHeight: 18,
    marginBottom: 10,
    textAlign: 'center',
  },
  startButton: {
    borderWidth: 1,
    borderColor: colors.accent.DEFAULT,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  startButtonText: {
    color: colors.accent.DEFAULT,
    fontSize: 13,
    fontFamily: 'Manrope-SemiBold',
  },
  historicalSection: {
    marginBottom: 28,
    gap: 12,
  },
  historicalTitle: {
    fontFamily: 'Cormorant-SemiBold',
    fontSize: 22,
    color: colors.text.primary,
    textAlign: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 4,
  },
  presetPill: {
    borderWidth: layout.card.borderWidth,
    borderColor: layout.card.borderColor,
    borderRadius: 999,
    paddingHorizontal: layout.card.padding,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  presetPillText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
  },
  savedSection: {
    backgroundColor: layout.card.backgroundColor,
    borderWidth: layout.card.borderWidth,
    borderColor: layout.card.borderColor,
    borderRadius: 16,
    padding: layout.card.padding,
  },
  savedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  savedTitle: {
    color: colors.accent.DEFAULT,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
  },
  refreshText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Medium',
  },
  savedList: {
    gap: 8,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: `${colors.border}99`,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surfaceLight,
  },
  savedDate: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
  loadButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceLight,
  },
  loadButtonDisabled: {
    opacity: 0.6,
  },
  loadButtonText: {
    color: colors.text.primary,
    fontSize: 12,
    fontFamily: 'Manrope-Medium',
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    marginBottom: 8,
  },
  loader: {
    marginVertical: 12,
  },
});
