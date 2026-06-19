import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { createComment, fetchPost } from '../../lib/community-feed-fetch';
import { formatApiError } from '../../lib/format-api-error';
import { formatCommunityTimestamp } from '../../lib/community-timestamp';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../constants/colors';
import type { CommunityComment, CommunityPost } from '../../types/community-feed';
import { UserAvatar } from './UserAvatar';

type PostCommentsSheetProps = {
  post: CommunityPost | null;
  visible: boolean;
  onClose: () => void;
  onCommentAdded: (postId: string) => void;
};

export function PostCommentsSheet({
  post,
  visible,
  onClose,
  onCommentAdded,
}: PostCommentsSheetProps) {
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const loadComments = useCallback(async () => {
    if (!post?.id) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchPost(post.id, authUserId);
      setComments(Array.isArray(detail.comments) ? detail.comments : []);
    } catch (err) {
      setError(formatApiError(err, 'Could not load comments'));
    } finally {
      setLoading(false);
    }
  }, [authUserId, post?.id]);

  useEffect(() => {
    if (!visible || !post?.id) return;
    setDraft('');
    void loadComments();
  }, [visible, post?.id, loadComments]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!post?.id || !authUserId || !body || sending) return;
    setSending(true);
    setError(null);
    try {
      const comment = await createComment(post.id, body, authUserId);
      setComments((prev) => [comment, ...prev]);
      setDraft('');
      onCommentAdded(post.id);
    } catch (err) {
      setError(formatApiError(err, 'Could not post comment'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Comments</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        {post ? (
          <View style={styles.postPreview}>
            <Text style={styles.previewBody} numberOfLines={3}>
              {post.body?.trim() || post.title?.trim() || 'Post'}
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent.DEFAULT} />
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyComments}>No comments yet. Start the conversation.</Text>
            }
            renderItem={({ item }) => {
              const name = item.author?.displayName?.trim() || 'Member';
              return (
                <View style={styles.commentRow}>
                  <UserAvatar
                    userId={item.userId}
                    displayName={name}
                    avatarUrl={item.author?.avatarUrl}
                    size={32}
                  />
                  <View style={styles.commentBody}>
                    <View style={styles.commentMeta}>
                      <Text style={styles.commentAuthor}>{name}</Text>
                      <Text style={styles.commentTime}>
                        {formatCommunityTimestamp(item.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.commentText}>{item.body}</Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.composeRow}>
          <TextInput
            style={styles.input}
            placeholder="Write a comment…"
            placeholderTextColor={colors.text.muted}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Pressable
            style={[styles.sendButton, (!draft.trim() || sending) && styles.sendDisabled]}
            onPress={() => void handleSend()}
            disabled={!draft.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.text.primary} />
            ) : (
              <Text style={styles.sendLabel}>Send</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontFamily: 'Manrope-SemiBold',
  },
  close: {
    color: colors.accent.DEFAULT,
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
  },
  postPreview: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  previewBody: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    lineHeight: 20,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  emptyComments: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    marginTop: 24,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  commentBody: {
    flex: 1,
    minWidth: 0,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentAuthor: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
  commentTime: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
  commentText: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    lineHeight: 20,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Manrope-Regular',
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 64,
    alignItems: 'center',
  },
  sendDisabled: {
    opacity: 0.5,
  },
  sendLabel: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
});
