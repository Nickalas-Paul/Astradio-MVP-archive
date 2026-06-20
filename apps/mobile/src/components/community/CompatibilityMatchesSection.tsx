import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../../constants/colors';
import {
  RELATIONAL_INTENT_OPTIONS,
  type RelationalIntent,
} from '../../constants/community-constants';
import {
  formatRefreshCountdown,
} from '../../lib/community-match-utils';
import type { MatchResult, PendingIntent } from '../../types/community';
import { MatchCarousel } from './MatchCarousel';

type CompatibilityMatchesSectionProps = {
  chartId: string | null;
  intent: RelationalIntent;
  onIntentChange: (intent: RelationalIntent) => void;
  matches: MatchResult[] | null;
  matchesLoaded: boolean;
  matchesLoading: boolean;
  matchesError: string | null;
  pendingOutgoing: PendingIntent[];
  onFindMatches: (mode: RelationalIntent) => Promise<void>;
  onRequestConnection: (userId: string, chartId: string, intent: RelationalIntent) => Promise<void>;
  mutationBusy?: boolean;
};

export function CompatibilityMatchesSection({
  chartId,
  intent,
  onIntentChange,
  matches,
  matchesLoaded,
  matchesLoading,
  matchesError,
  pendingOutgoing,
  onFindMatches,
  onRequestConnection,
  mutationBusy = false,
}: CompatibilityMatchesSectionProps) {
  const [userTriggered, setUserTriggered] = useState(false);
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null);
  const [requestMsg, setRequestMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(formatRefreshCountdown());

  useEffect(() => {
    const update = () => setCountdown(formatRefreshCountdown());
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleFindMatches = useCallback(async () => {
    setUserTriggered(true);
    await onFindMatches(intent);
  }, [intent, onFindMatches]);

  const handleRequest = useCallback(
    async (userId: string, chartId: string) => {
      setRequestMsg(null);
      setRequestBusyId(userId);
      try {
        await onRequestConnection(userId, chartId, intent);
        setRequestMsg('Request sent');
      } catch (err) {
        const message =
          err && typeof err === 'object' && 'error' in err
            ? String((err as { error?: string }).error ?? 'Request failed')
            : 'Request failed';
        setRequestMsg(message.replace(/_/g, ' '));
      } finally {
        setRequestBusyId(null);
      }
    },
    [intent, onRequestConnection]
  );

  const matchList = matches ?? [];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Intentional matching</Text>
      <Text style={styles.sectionSubtitle}>
        Choose an intent, then find matches. Results load only after you click Find matches.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Compatibility matches</Text>

        <View style={styles.intentRow}>
          {RELATIONAL_INTENT_OPTIONS.map((option) => {
            const active = intent === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onIntentChange(option.value)}
                style={[styles.intentPill, active && styles.intentPillActive]}
              >
                <Text style={[styles.intentPillText, active && styles.intentPillTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => void handleFindMatches()}
          disabled={matchesLoading || !chartId}
          style={({ pressed }) => [
            styles.findButton,
            (matchesLoading || !chartId) && styles.findButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          {matchesLoading ? (
            <ActivityIndicator color={colors.text.primary} />
          ) : (
            <Text style={styles.findButtonText}>Find matches</Text>
          )}
        </Pressable>

        <Text style={styles.hint}>
          Daily matches load when you click Find matches. Change intent and click again to refresh.
        </Text>

        {!chartId ? (
          <Text style={styles.warning}>Add your natal chart to find compatibility matches.</Text>
        ) : null}

        {requestMsg ? <Text style={styles.msg}>{requestMsg}</Text> : null}

        {userTriggered && matchesLoading ? (
          <View style={styles.skeleton} />
        ) : null}

        {userTriggered && matchesError ? (
          <Text style={styles.errorText}>{matchesError}</Text>
        ) : null}

        {userTriggered && matchesLoaded && !matchesLoading && matchList.length === 0 ? (
          <Text style={styles.emptyText}>
            No matches found today. Try a different intent or check back tomorrow.
          </Text>
        ) : null}

        {userTriggered && !matchesLoading && matchList.length > 0 ? (
          <View style={styles.results}>
            <Text style={styles.resultsDate}>
              Results for{' '}
              {new Date().toLocaleDateString(undefined, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
            <MatchCarousel
              matches={matchList}
              intent={intent}
              pendingOutgoing={pendingOutgoing}
              onRequestConnection={handleRequest}
              requestBusyId={requestBusyId}
              mutationBusy={mutationBusy}
            />
            <Text style={styles.footerMeta}>New matches in: {countdown}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  sectionTitle: {
    color: colors.accent.DEFAULT,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    marginBottom: 16,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 12,
  },
  intentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  intentPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  intentPillActive: {
    backgroundColor: colors.accent.DEFAULT,
    borderColor: colors.accent.DEFAULT,
  },
  intentPillText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: 'Manrope-Medium',
  },
  intentPillTextActive: {
    color: colors.text.primary,
    fontFamily: 'Manrope-SemiBold',
  },
  findButton: {
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  findButtonDisabled: {
    opacity: 0.6,
  },
  findButtonText: {
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
  },
  hint: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    lineHeight: 18,
    marginBottom: 8,
  },
  warning: {
    color: colors.text.muted,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    marginTop: 4,
  },
  msg: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  skeleton: {
    height: 200,
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    marginTop: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  results: {
    marginTop: 16,
  },
  resultsDate: {
    color: colors.text.muted,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    marginBottom: 12,
  },
  footerMeta: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.85,
  },
});
