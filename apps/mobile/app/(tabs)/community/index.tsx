import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommunitySubTabs } from '../../../src/components/community/CommunitySubTabs';
import { CompatibilityMatchesSection } from '../../../src/components/community/CompatibilityMatchesSection';
import { ConnectionsTabContent } from '../../../src/components/community/ConnectionsTabContent';
import { DiscoverySearchSection } from '../../../src/components/community/DiscoverySearchSection';
import { FeedTabContent } from '../../../src/components/community/FeedTabContent';
import { MessagesTabContent } from '../../../src/components/community/MessagesTabContent';
import {
  COMMUNITY_SUB_TABS,
  type CommunitySubTabId,
  type RelationalIntent,
} from '../../../src/constants/community-constants';
import { AUTH_HORIZONTAL_PADDING } from '../../../src/constants/auth-styles';
import { colors } from '../../../src/constants/colors';
import { typography } from '../../../src/constants/typography';
import { useCommunityData } from '../../../src/hooks/useCommunityData';
import { FtueBanner } from '../../../src/components/ftue/FtueBanner';
import { FTUE_KEYS } from '../../../src/lib/ftue-storage';

export default function CommunityScreen() {
  const [activeTab, setActiveTab] = useState<CommunitySubTabId>('discovery');
  const [discoveryIntent, setDiscoveryIntent] = useState<RelationalIntent>('friend');
  const [refreshing, setRefreshing] = useState(false);

  const {
    pairs,
    matches,
    matchesLoaded,
    matchesLoading,
    matchesError,
    pendingIncoming,
    pendingOutgoing,
    chartId,
    loading,
    error,
    searchLoading,
    mutationBusy,
    refresh,
    findMatches,
    searchUsers,
    sendConnect,
    acceptIntent,
    declineIntent,
    cancelIntent,
  } = useCommunityData();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const handleRequestConnection = useCallback(
    async (toUserId: string, toChartId: string, intent: RelationalIntent = discoveryIntent) => {
      await sendConnect(toUserId, toChartId, intent);
    },
    [sendConnect, discoveryIntent]
  );

  const isFeedTab = activeTab === 'feed';
  const isMessagesTab = activeTab === 'messages';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Community</Text>
        <Text style={styles.subtitle}>
          Discover, connect, and share with the Astradio community.
        </Text>

        <CommunitySubTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={COMMUNITY_SUB_TABS}
        />
      </View>

      {isFeedTab ? (
        <View style={styles.tabPanel}>
          <FeedTabContent active />
        </View>
      ) : isMessagesTab ? (
        <View style={styles.tabPanel}>
          <MessagesTabContent active />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
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
          <View style={styles.tabContent}>
            {activeTab === 'discovery' || activeTab === 'connections' ? (
              <FtueBanner
                storageKey={FTUE_KEYS.connectionsWelcome}
                message="Discovery finds people whose charts resonate with yours. Connections tracks the relationships you've built. You already have one. Take a look."
              />
            ) : null}

            {activeTab === 'discovery' ? (
              <>
                <Text style={styles.tabHeading}>Discovery</Text>
                <Text style={styles.tabDescription}>
                  Find meaningful connections based on astrological compatibility. Choose your intent
                  and we&apos;ll show you the best matches.
                </Text>

                <DiscoverySearchSection
                  intent={discoveryIntent}
                  pendingOutgoing={pendingOutgoing}
                  searchUsers={searchUsers}
                  searchLoading={searchLoading}
                  onRequestConnection={(userId, chartId) =>
                    handleRequestConnection(userId, chartId, discoveryIntent)
                  }
                  mutationBusy={mutationBusy}
                />

                <CompatibilityMatchesSection
                  chartId={chartId}
                  intent={discoveryIntent}
                  onIntentChange={setDiscoveryIntent}
                  matches={matches}
                  matchesLoaded={matchesLoaded}
                  matchesLoading={matchesLoading}
                  matchesError={matchesError}
                  pendingOutgoing={pendingOutgoing}
                  onFindMatches={findMatches}
                  onRequestConnection={handleRequestConnection}
                  mutationBusy={mutationBusy}
                />
              </>
            ) : null}

            {activeTab === 'connections' ? (
              <ConnectionsTabContent
                pairs={pairs}
                pendingIncoming={pendingIncoming}
                pendingOutgoing={pendingOutgoing}
                loading={loading}
                error={error}
                onRefresh={refresh}
                onSwitchToDiscovery={() => setActiveTab('discovery')}
                onAccept={acceptIntent}
                onDecline={declineIntent}
                onCancel={cancelIntent}
                mutationBusy={mutationBusy}
              />
            ) : null}

          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: AUTH_HORIZONTAL_PADDING,
  },
  tabPanel: {
    flex: 1,
    paddingHorizontal: AUTH_HORIZONTAL_PADDING,
    marginTop: 12,
  },
  content: {
    paddingHorizontal: AUTH_HORIZONTAL_PADDING,
    paddingBottom: 40,
  },
  title: {
    ...typography.screenTitle,
    color: colors.text.primary,
    marginTop: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: 15,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 21,
  },
  tabContent: {
    marginTop: 20,
  },
  tabHeading: {
    color: colors.accent.DEFAULT,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 6,
  },
  tabDescription: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    marginBottom: 20,
    lineHeight: 20,
  },
});
