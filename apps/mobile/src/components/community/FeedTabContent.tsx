import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useCommunityFeed } from '../../hooks/useCommunityFeed';
import { formatApiError } from '../../lib/format-api-error';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../constants/colors';
import type { CommunityPost } from '../../types/community-feed';
import { PostCard } from './PostCard';
import { PostCommentsSheet } from './PostCommentsSheet';

type FeedTabContentProps = {
  active: boolean;
};

type SelectedImage = {
  uri: string;
  mimeType: string;
};

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

  const [body, setBody] = useState('');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [posting, setPosting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [commentsPost, setCommentsPost] = useState<CommunityPost | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setSelectedImage({
      uri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
    });
  };

  const handlePost = async () => {
    const trimmed = body.trim();
    if (!trimmed && !selectedImage) return;
    setPosting(true);
    try {
      const { moderationWarning } = await submitPost(
        trimmed,
        undefined,
        selectedImage?.uri,
        selectedImage?.mimeType
      );
      setBody('');
      setSelectedImage(null);
      if (moderationWarning) {
        Alert.alert('Image not added', moderationWarning);
      }
    } catch (err) {
      Alert.alert('Could not post', formatApiError(err, 'Something went wrong'));
    } finally {
      setPosting(false);
    }
  };

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

  const renderHeader = () => (
    <View>
      {trendingTags.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagsRow}
        >
          {trendingTags.map((item) => (
            <Pressable
              key={item.tag}
              style={styles.tagChip}
              onPress={() => console.log('tag:', item.tag)}
            >
              <Text style={styles.tagChipText}>#{item.tag}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.composeCard}>
        <Text style={styles.composeTitle}>Share with the community</Text>
        <TextInput
          style={styles.composeInput}
          placeholder="What's on your mind?"
          placeholderTextColor={colors.text.muted}
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
        />
        {selectedImage ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
            <Pressable style={styles.removePreview} onPress={() => setSelectedImage(null)}>
              <Text style={styles.removePreviewText}>Remove</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.composeActions}>
          <Pressable style={styles.attachButton} onPress={() => void pickImage()} disabled={posting}>
            <Text style={styles.attachIcon}>📷</Text>
          </Pressable>
          <Pressable
            style={[styles.postButton, posting && styles.postButtonDisabled]}
            onPress={() => void handlePost()}
            disabled={posting || (!body.trim() && !selectedImage)}
          >
            {posting ? (
              <ActivityIndicator size="small" color={colors.text.primary} />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </Pressable>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  if (loading && posts.length === 0) {
    return (
      <View style={styles.loadingWrap}>
        {renderHeader()}
        <ActivityIndicator color={colors.accent.DEFAULT} style={styles.loader} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentUserId={authUserId}
            onToggleLike={toggleLike}
            onOpenComments={setCommentsPost}
            onDelete={handleDelete}
          />
        )}
        ListHeaderComponent={renderHeader}
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
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={colors.accent.DEFAULT} style={styles.footerLoader} />
          ) : null
        }
      />

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
  listContent: {
    paddingBottom: 32,
  },
  loadingWrap: {
    flex: 1,
  },
  loader: {
    marginTop: 32,
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
  composeCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
  },
  composeTitle: {
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 10,
  },
  composeInput: {
    minHeight: 88,
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Manrope-Regular',
    lineHeight: 22,
  },
  previewWrap: {
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 160,
    backgroundColor: colors.surfaceLight,
  },
  removePreview: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removePreviewText: {
    color: colors.text.primary,
    fontSize: 12,
    fontFamily: 'Manrope-SemiBold',
  },
  composeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  attachButton: {
    padding: 8,
  },
  attachIcon: {
    fontSize: 22,
  },
  postButton: {
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  postButtonDisabled: {
    opacity: 0.6,
  },
  postButtonText: {
    color: colors.text.primary,
    fontSize: 15,
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
