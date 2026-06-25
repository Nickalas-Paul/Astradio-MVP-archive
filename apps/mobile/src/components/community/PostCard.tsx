import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { HashtagText } from './HashtagText';
import { PostAudioSection } from './PostAudioSection';
import { PostImage } from './PostImage';
import { UserAvatar } from './UserAvatar';
import { colors } from '../../constants/colors';
import { formatCommunityTimestamp } from '../../lib/community-timestamp';
import type { CommunityPost } from '../../types/community-feed';

type PostCardProps = {
  post: CommunityPost;
  currentUserId?: string | null;
  onToggleLike: (postId: string) => void;
  onOpenComments: (post: CommunityPost) => void;
  onDelete?: (postId: string) => void;
};

function HeartIcon({ filled }: { filled: boolean }) {
  return <Text style={[styles.actionIcon, filled && styles.actionIconActive]}>{filled ? '♥' : '♡'}</Text>;
}

export function PostCard({
  post,
  currentUserId,
  onToggleLike,
  onOpenComments,
  onDelete,
}: PostCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isOwner = Boolean(currentUserId && post.userId === currentUserId);
  const displayName = post.author?.displayName?.trim() || 'Anonymous';
  const handle = post.author?.handle?.trim().replace(/^@/, '') || '';

  const confirmDelete = () => {
    setMenuOpen(false);
    Alert.alert('Delete post', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void onDelete?.(post.id);
        },
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.authorRow}>
        <UserAvatar
          userId={post.userId}
          displayName={displayName}
          avatarUrl={post.author?.avatarUrl}
          size={40}
        />
        <View style={styles.authorMeta}>
          <Text style={styles.displayName} numberOfLines={1}>
            {displayName}
            {handle ? <Text style={styles.handle}> @{handle}</Text> : null}
          </Text>
          <Text style={styles.timestamp}>{formatCommunityTimestamp(post.createdAt)}</Text>
        </View>
        {isOwner ? (
          <>
            <Pressable
              style={styles.menuButton}
              onPress={() => setMenuOpen(true)}
              accessibilityLabel="Post options"
            >
              <Text style={styles.menuDots}>···</Text>
            </Pressable>
            <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
              <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
                <View style={styles.menuSheet}>
                  <TouchableOpacity style={styles.menuItem} onPress={confirmDelete}>
                    <Text style={styles.menuDelete}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Modal>
          </>
        ) : null}
      </View>

      {post.title?.trim() ? <Text style={styles.title}>{post.title.trim()}</Text> : null}

      {post.body?.trim() ? (
        <View style={styles.bodyWrap}>
          <HashtagText text={post.body} />
        </View>
      ) : null}

      {post.imageUrl ? <PostImage postId={post.id} imageUrl={post.imageUrl} /> : null}
      {post.audioExportId ? (
        <PostAudioSection exportId={post.audioExportId} postId={post.id} label={post.audioLabel} />
      ) : null}

      <View style={styles.actions}>
        <Pressable style={styles.actionButton} onPress={() => onToggleLike(post.id)}>
          <HeartIcon filled={!!post.likedByViewer} />
          <Text style={styles.actionCount}>{post.likeCount ?? 0}</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => onOpenComments(post)}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{post.commentCount ?? 0}</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => console.log('share:', post.id)}>
          <Text style={styles.actionIcon}>↗</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authorMeta: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
  },
  handle: {
    color: colors.text.secondary,
    fontFamily: 'Manrope-Regular',
  },
  timestamp: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    marginTop: 2,
  },
  menuButton: {
    padding: 4,
  },
  menuDots: {
    color: colors.text.muted,
    fontSize: 18,
    letterSpacing: 1,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuItem: {
    paddingVertical: 12,
  },
  menuDelete: {
    color: colors.error,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
    textAlign: 'center',
  },
  title: {
    color: colors.text.primary,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
    marginTop: 10,
  },
  bodyWrap: {
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIcon: {
    color: colors.text.secondary,
    fontSize: 18,
  },
  actionIconActive: {
    color: colors.error,
  },
  actionCount: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
  },
});
