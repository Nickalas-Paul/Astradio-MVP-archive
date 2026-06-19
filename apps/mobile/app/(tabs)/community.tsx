import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConnectionCard } from '../../src/components/community/ConnectionCard';
import { CommunitySkeleton } from '../../src/components/community/CommunitySkeleton';
import { DiscoverySection } from '../../src/components/community/DiscoverySection';
import { PendingIntentsSection } from '../../src/components/community/PendingIntentsSection';
import { AUTH_HORIZONTAL_PADDING } from '../../src/constants/auth-styles';
import { colors } from '../../src/constants/colors';
import { useCommunityData } from '../../src/hooks/useCommunityData';

function SectionDivider() {
  return <View style={styles.sectionDivider} />;
}

function SectionHeading({ title }: { title: string }) {
  return <Text style={styles.sectionHeading}>{title}</Text>;
}

export default function CommunityScreen() {
  const {
    pairs,
    matches,
    pendingIncoming,
    pendingOutgoing,
    loading,
    error,
    searchLoading,
    mutationBusy,
    refresh,
    searchUsers,
    sendConnect,
    acceptIntent,
    declineIntent,
    cancelIntent,
  } = useCommunityData();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

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
        <Text style={styles.title}>Community</Text>

        {loading && pairs.length === 0 && matches.length === 0 ? <CommunitySkeleton /> : null}

        {error && pairs.length === 0 ? (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void refresh()}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading || pairs.length > 0 || matches.length > 0 ? (
          <>
            <PendingIntentsSection
              incoming={pendingIncoming}
              outgoing={pendingOutgoing}
              onAccept={acceptIntent}
              onDecline={declineIntent}
              onCancel={cancelIntent}
              mutationBusy={mutationBusy}
            />

            <SectionHeading title="Your Connections" />
            {pairs.length === 0 ? (
              <Text style={styles.emptyText}>
                No connections yet. Discover people below.
              </Text>
            ) : (
              pairs.map((pair) => <ConnectionCard key={pair.id} pair={pair} />)
            )}

            <SectionDivider />

            <DiscoverySection
              matches={matches}
              pairs={pairs}
              pendingOutgoing={pendingOutgoing}
              searchUsers={searchUsers}
              searchLoading={searchLoading}
              onConnect={sendConnect}
              connectBusy={mutationBusy}
            />
          </>
        ) : null}
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
    marginBottom: 16,
  },
  sectionHeading: {
    color: colors.accent.DEFAULT,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 12,
  },
  sectionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginVertical: 20,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    paddingVertical: 16,
    marginBottom: 8,
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
});
