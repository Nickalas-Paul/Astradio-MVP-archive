import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { AUTH_HORIZONTAL_PADDING } from '../../constants/auth-styles';
import { colors } from '../../constants/colors';
import type { RelationalIntent } from '../../constants/community-constants';
import { calculateDiscoveryRequestsRemaining } from '../../lib/community-match-utils';
import type { MatchResult, PendingIntent } from '../../types/community';
import { MatchCard } from './MatchCard';

type MatchCarouselProps = {
  matches: MatchResult[];
  intent: RelationalIntent;
  pendingOutgoing: PendingIntent[];
  onRequestConnection: (userId: string, chartId: string) => Promise<void>;
  requestBusyId?: string | null;
  mutationBusy?: boolean;
};

export function MatchCarousel({
  matches,
  intent,
  pendingOutgoing,
  onRequestConnection,
  requestBusyId = null,
  mutationBusy = false,
}: MatchCarouselProps) {
  const { width } = useWindowDimensions();
  const cardWidth = width - AUTH_HORIZONTAL_PADDING * 2 - 32;
  const listRef = useRef<FlatList<MatchResult>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const requestsRemaining = calculateDiscoveryRequestsRemaining(pendingOutgoing.length);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / cardWidth);
      if (index >= 0 && index < matches.length) {
        setActiveIndex(index);
      }
    },
    [cardWidth, matches.length]
  );

  if (matches.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={matches}
        keyExtractor={(item) => `${item.userId}-${item.chartId}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={[styles.page, { width: cardWidth }]}>
            <MatchCard
              match={item}
              intent={intent}
              pendingOutgoing={pendingOutgoing}
              onRequestConnection={onRequestConnection}
              requestBusy={requestBusyId === item.userId}
              mutationBusy={mutationBusy}
            />
          </View>
        )}
      />

      <View style={styles.dots} accessibilityRole="tablist">
        {matches.map((match, index) => (
          <View
            key={`dot-${match.userId}`}
            style={[styles.dot, index === activeIndex && styles.dotActive]}
            accessibilityLabel={`Match ${index + 1} of ${matches.length}`}
          />
        ))}
      </View>

      <Text style={styles.footerMeta}>
        Card {activeIndex + 1} of {matches.length}
      </Text>
      <Text style={styles.footerMeta}>{requestsRemaining} requests remaining</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  listContent: {
    paddingHorizontal: 0,
  },
  page: {
    paddingHorizontal: 0,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceLight,
  },
  dotActive: {
    backgroundColor: colors.accent.DEFAULT,
    transform: [{ scale: 1.15 }],
  },
  footerMeta: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    marginTop: 2,
  },
});
