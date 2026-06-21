import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompatibilityReading } from '../../../src/components/community/CompatibilityReading';
import { ConnectionAudioPlayer } from '../../../src/components/community/ConnectionAudioPlayer';
import { DualWheelDisplay, DualWheelSkeleton } from '../../../src/components/community/DualWheelDisplay';
import { SonicBulletsSection } from '../../../src/components/community/SonicBulletsSection';
import { AUTH_HORIZONTAL_PADDING } from '../../../src/constants/auth-styles';
import { colors } from '../../../src/constants/colors';
import { useConnectionDetail } from '../../../src/hooks/useConnectionDetail';
import { useAuthStore } from '../../../src/store/auth';

function formatLabel(label: string | undefined): string | null {
  const trimmed = String(label ?? '').trim();
  if (!trimmed) return null;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export default function ConnectionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    relationshipId: string;
    peerDisplayName?: string;
    peerHandle?: string;
    label?: string;
  }>();

  const relationshipId = typeof params.relationshipId === 'string' ? params.relationshipId : '';
  const peerDisplayName =
    typeof params.peerDisplayName === 'string' ? params.peerDisplayName : undefined;
  const peerHandle = typeof params.peerHandle === 'string' ? params.peerHandle : undefined;
  const labelBadge = formatLabel(typeof params.label === 'string' ? params.label : undefined);
  const viewerDisplayName = useAuthStore((state) => state.user?.displayName ?? undefined);

  const {
    relationship,
    readingShort,
    readingLong,
    sonicBullets,
    viewerSnapshot,
    peerSnapshot,
    viewerLabel,
    peerLabel,
    exportId,
    audioAvailable,
    audioGenerating,
    generateAudio,
    materializeError,
    loading,
    error,
    refresh,
  } = useConnectionDetail({
    relationshipId,
    peerDisplayName,
    viewerDisplayName,
  });

  const displayName = peerDisplayName?.trim() || peerLabel;
  const hasReading = Boolean(readingShort.trim() || readingLong.trim());

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back to Community</Text>
      </Pressable>

      {loading ? (
        <View style={styles.loadingBlock}>
          <View style={styles.headerSkeleton} />
          <DualWheelSkeleton />
          <View style={styles.textSkeleton} />
          <View style={styles.textSkeletonShort} />
        </View>
      ) : null}

      {error && !relationship ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void refresh()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && relationship ? (
        <>
          <View style={styles.pinnedTop}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {displayName}
                {peerHandle?.trim() ? (
                  <Text style={styles.handle}> @{peerHandle.trim()}</Text>
                ) : null}
              </Text>
              {labelBadge ? (
                <View style={styles.labelBadge}>
                  <Text style={styles.labelBadgeText}>{labelBadge}</Text>
                </View>
              ) : null}
            </View>

            <DualWheelDisplay
              viewerLabel={viewerLabel}
              peerLabel={peerDisplayName?.trim() || peerLabel}
              viewerWheel={viewerSnapshot}
              peerWheel={peerSnapshot}
            />
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
            {materializeError ? (
              <Text style={styles.warning}>{materializeError}</Text>
            ) : null}

            <SonicBulletsSection bullets={sonicBullets} />

            {hasReading ? (
              <CompatibilityReading short={readingShort} long={readingLong} />
            ) : null}

            {hasReading && relationship.comparisonId ? (
              <ConnectionAudioPlayer
                visible
                exportId={exportId}
                audioAvailable={audioAvailable}
                audioGenerating={audioGenerating}
                peerDisplayName={displayName}
                onGenerate={generateAudio}
              />
            ) : null}
          </ScrollView>
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: AUTH_HORIZONTAL_PADDING,
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  pinnedTop: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    marginBottom: 8,
    backgroundColor: colors.background,
  },
  backButton: {
    paddingVertical: 8,
    marginBottom: 4,
  },
  backText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Medium',
  },
  header: {
    marginBottom: 12,
    gap: 8,
  },
  title: {
    color: colors.text.primary,
    fontSize: 24,
    fontFamily: 'Cormorant-SemiBold',
  },
  handle: {
    color: colors.text.secondary,
    fontSize: 18,
    fontFamily: 'Manrope-Regular',
  },
  labelBadge: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  labelBadgeText: {
    color: colors.text.secondary,
    fontSize: 10,
    fontFamily: 'Manrope-Medium',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  warning: {
    color: colors.error,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    marginBottom: 12,
  },
  loadingBlock: {
    gap: 16,
  },
  headerSkeleton: {
    height: 32,
    width: '60%',
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  textSkeleton: {
    height: 120,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  textSkeletonShort: {
    height: 80,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  errorBlock: {
    alignItems: 'center',
    paddingVertical: 40,
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
});
