import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCommunityMessages } from '../../hooks/useCommunityMessages';
import { ConversationsList } from './ConversationsList';
import { SignalsSection } from './SignalsSection';
import { colors } from '../../constants/colors';

type MessagesTabContentProps = {
  active: boolean;
};

export function MessagesTabContent({ active }: MessagesTabContentProps) {
  const {
    conversations,
    requests,
    incomingSignals,
    sentSignals,
    recentActivity,
    loading,
    error,
    refresh,
    acceptRequest,
    declineRequest,
    acknowledgeSignal,
  } = useCommunityMessages(active);

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
    <ScrollView
      style={styles.scroll}
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
      {loading && conversations.length === 0 && requests.length === 0 ? (
        <ActivityIndicator color={colors.accent.DEFAULT} style={styles.loader} />
      ) : null}

      <SignalsSection
        incomingSignals={incomingSignals}
        sentSignals={sentSignals}
        recentActivity={recentActivity}
        loading={loading}
        error={error}
        onAcknowledge={acknowledgeSignal}
        onRefresh={() => void refresh()}
      />

      <ConversationsList
        conversations={conversations}
        requests={requests}
        onAcceptRequest={acceptRequest}
        onDeclineRequest={declineRequest}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  loader: {
    marginVertical: 24,
  },
});
