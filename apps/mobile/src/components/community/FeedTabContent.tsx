import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCommunityFeed } from '../../hooks/useCommunityFeed';
import { formatApiError } from '../../lib/format-api-error';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../constants/colors';
import type { CommunityPost, TrendingTag } from '../../types/community-feed';
import { FeedComposeSection } from './FeedComposeSection';
import { PostCard } from './PostCard';
import { PostCommentsSheet } from './PostCommentsSheet';

type FeedTabContentProps = {
  active: boolean;
};

function FeedTrendingTags({ tags }: { tags: TrendingTag[] }) {
  if (tags.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={styles.tagsRow}
    >
      {tags.map((item) => (
        <Pressable
          key={item.tag}
          style={styles.tagChip}
          onPress={() => console.log('tag:', item.tag)}
        >
          <Text style={styles.tagChipText}>#{item.tag}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function FeedTabContent({ active }: FeedTabContentProps) {
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const {
    posts,
    trendingTags,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    submitPost,
    toggleLike,
    removePost,
    incrementCommentCount,
  } = useCommunityFeed(active);

  const [refreshing, setRefreshing] = useState(false);
  const [commentsPost, setCommentsPost] = useState<CommunityPost | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const handleDelete = useCallback(
    async (postId: string) => {
      try {
        await removePost(postId);
      } catch (err) {
        Alert.alert('Could not delete', formatApiError(err, 'Something went wrong'));
      }
    },
    [removePost]
  );

  const renderPost = useCallback(
    ({ item }: { item: CommunityPost }) => (
      <PostCard
        post={item}
        currentUserId={authUserId}
        onToggleLike={toggleLike}
        onOpenComments={setCommentsPost}
        onDelete={handleDelete}
      />
    ),
    [authUserId, toggleLike, handleDelete]
  );

  return (
    <>
      <View style={styles.container}>
        <FeedTrendingTags tags={trendingTags} />
        <FeedComposeSection submitPost={submitPost} />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading && posts.length === 0 ? (
          <ActivityIndicator color={colors.accent.DEFAULT} style={styles.loader} />
        ) : (
          <FlatList
            style={styles.list}
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={renderPost}
            ListEmptyComponent={
              !loading ? (
                <Text style={styles.emptyFeed}>No posts yet. Be the first to share.</Text>
              ) : null
            }
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void onRefresh()}
                tintColor={colors.accent.DEFAULT}
                colors={[colors.accent.DEFAULT]}
              />
            }
            onEndReached={() => {
              if (hasMore && !loadingMore) void loadMore();
            }}
            onEndReachedThreshold={0.4}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator color={colors.accent.DEFAULT} style={styles.footerLoader} />
              ) : null
            }
          />
        )}
      </View>

      <PostCommentsSheet
        post={commentsPost}
        visible={commentsPost != null}
        onClose={() => setCommentsPost(null)}
        onCommentAdded={incrementCommentCount}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 32,
  },
  loader: {
    marginTop: 24,
  },
  tagsRow: {
    gap: 8,
    paddingBottom: 12,
  },
  tagChip: {
    backgroundColor: colors.accent.deep,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.accent.DEFAULT,
  },
  tagChipText: {
    color: colors.text.primary,
    fontSize: 13,
    fontFamily: 'Manrope-SemiBold',
  },
  emptyFeed: {
    color: colors.text.muted,
    fontSize: 15,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    paddingVertical: 32,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    marginBottom: 12,
  },
  footerLoader: {
    paddingVertical: 16,
  },
});
