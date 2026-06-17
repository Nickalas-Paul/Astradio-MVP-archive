'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CommunityPostCard } from '@/components/community/posts/CommunityPostCard';
import { CommunityAudioArtifactPicker } from '@/components/community/posts/CommunityAudioArtifactPicker';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import {
  useCommunityFeed,
  createCommunityPost,
  uploadCommunityPostImage,
  deleteCommunityPost,
} from '@/core/social/community-posts-hooks';
import { getApiBaseUrl } from '@/core/api-base';
import { isFeatureEnabled } from '@/core/config/flags';
import { useProfile } from '@/core/social/hooks';
import {
  AudioAttachIcon,
  FeedEmptyIcon,
  ImageAttachIcon,
} from '@/components/community/posts/community-post-icons';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/gif,image/webp';

export function CommunityFeed() {
  const enabled = isFeatureEnabled('ENABLE_COMMUNITY_POSTS');
  const { user } = useProfile();
  const { posts, loading, loadingMore, error, hasMore, loadMore, refresh, patchPost, prependPost, removePost } =
    useCommunityFeed();
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [audioExportId, setAudioExportId] = useState<string | null>(null);
  const [audioLabel, setAudioLabel] = useState<string | null>(null);
  const [audioPickerOpen, setAudioPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const onLikeChange = useCallback(
    (postId: string, patch: Parameters<typeof patchPost>[1]) => patchPost(postId, patch),
    [patchPost]
  );

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore, loading, loadingMore]);

  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return;
    const es = new EventSource(`${getApiBaseUrl() || ''}/api/community/events/stream`);
    const onFeed = () => void refresh();
    es.addEventListener('feed', onFeed);
    return () => {
      es.removeEventListener('feed', onFeed);
      es.close();
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (!moderationError) return;
    const timer = window.setTimeout(() => setModerationError(null), 5000);
    return () => window.clearTimeout(timer);
  }, [moderationError]);

  const clearImage = () => {
    setImageFile(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onImageSelected = (file: File | null) => {
    setImageError(null);
    if (!file) {
      clearImage();
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Image must be 5MB or smaller.');
      clearImage();
      return;
    }
    setImageFile(file);
  };

  const canSubmit = draft.trim() || imageFile || audioExportId;

  const submitPost = async () => {
    if (!canSubmit) return;
    setPosting(true);
    setModerationError(null);
    setImageError(null);
    setSubmitError(null);
    const hadImage = !!imageFile;
    const hadText = !!draft.trim();
    const hadAudio = !!audioExportId;
    try {
      const post = await createCommunityPost({
        body: draft.trim(),
        audioExportId: audioExportId || undefined,
        audioLabel: audioLabel || undefined,
        pendingImage: hadImage,
      });
      let finalPost = post;
      if (imageFile) {
        try {
          finalPost = await uploadCommunityPostImage(post.id, imageFile);
        } catch (e) {
          const err = e as Error & { code?: string };
          if (!hadText && !hadAudio) {
            await deleteCommunityPost(post.id).catch(() => {});
            if (err.code === 'content_moderation_failed') {
              setModerationError(
                "Your post image couldn't be published because it contains content that violates our community guidelines."
              );
            } else {
              setImageError(err instanceof Error ? err.message : 'Failed to upload image');
            }
            return;
          }
          if (err.code === 'content_moderation_failed') {
            setModerationError(
              "Your post was published without the image. The image violates our community guidelines."
            );
          } else {
            setImageError(err instanceof Error ? err.message : 'Post published, but the image failed to upload.');
          }
        }
      }
      prependPost(finalPost);
      setDraft('');
      clearImage();
      setAudioExportId(null);
      setAudioLabel(null);
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === 'content_moderation_failed') {
        setModerationError(
          "Your post couldn't be published because it contains content that violates our community guidelines."
        );
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Failed to publish post');
      }
    } finally {
      setPosting(false);
    }
  };

  if (!enabled) {
    return (
      <Card elevation="resting" className="text-sm text-text-secondary">
        Community posts are not enabled for your account yet.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card elevation="resting" className="space-y-3 relative">
        <h2 className="text-h3 font-serif text-text-primary">Share with the community</h2>
        {moderationError ? (
          <p className="text-sm text-red-400" role="alert">
            {moderationError}
          </p>
        ) : null}
        {submitError ? (
          <p className="text-sm text-red-400" role="alert">
            {submitError}
          </p>
        ) : null}
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (moderationError) setModerationError(null);
          }}
          rows={3}
          placeholder="What's on your mind?"
          className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-text-primary"
        />

        {imagePreviewUrl ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreviewUrl}
              alt="Attachment preview"
              className="max-h-40 rounded-lg border border-border object-cover"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-surface-2 border border-border text-text-secondary hover:text-text-primary text-sm"
              aria-label="Remove image"
            >
              ×
            </button>
          </div>
        ) : null}

        {audioExportId && audioLabel ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-0 px-3 py-1.5 text-xs text-text-secondary max-w-full">
            <AudioAttachIcon />
            <span className="truncate">{audioLabel}</span>
            <button
              type="button"
              onClick={() => {
                setAudioExportId(null);
                setAudioLabel(null);
              }}
              className="text-text-secondary hover:text-text-primary shrink-0"
              aria-label="Remove audio"
            >
              ×
            </button>
          </div>
        ) : null}

        {imageError ? (
          <p className="text-xs text-red-400" role="alert">
            {imageError}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              className="sr-only"
              onChange={(e) => onImageSelected(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition-colors"
              aria-label="Attach image"
            >
              <ImageAttachIcon />
            </button>
            <button
              type="button"
              onClick={() => setAudioPickerOpen(true)}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition-colors"
              aria-label="Attach audio from Library"
            >
              <AudioAttachIcon />
            </button>
          </div>
          <Button type="button" size="sm" disabled={posting || !canSubmit} onClick={() => void submitPost()}>
            {posting ? 'Posting…' : 'Post'}
          </Button>
        </div>
      </Card>

      <CommunityAudioArtifactPicker
        open={audioPickerOpen}
        onClose={() => setAudioPickerOpen(false)}
        onSelect={(artifact) => {
          setAudioExportId(artifact.exportId);
          setAudioLabel(artifact.label);
        }}
      />

      {loading ? <p className="text-sm text-text-secondary">Loading feed…</p> : null}
      {error ? (
        <Card elevation="flat" className="text-sm text-red-400 space-y-2">
          <p>{error}</p>
          <Button type="button" size="sm" variant="ghost" onClick={() => void refresh()}>
            Retry
          </Button>
        </Card>
      ) : null}

      <ul className="space-y-4">
        {posts.map((post) => (
          <li key={post.id}>
            <CommunityPostCard
              post={post}
              currentUserId={user?.id ?? null}
              onLikeChange={onLikeChange}
              onDelete={removePost}
              onRestore={prependPost}
              onPostChange={(postId, patch) => patchPost(postId, patch)}
            />
          </li>
        ))}
      </ul>

      {posts.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center text-center min-h-[280px] px-4 space-y-4">
          <FeedEmptyIcon />
          <p className="text-sm text-text-secondary max-w-md leading-relaxed">
            The community feed is quiet. Share a reading, a transit insight, or just say hello.
          </p>
        </div>
      ) : null}

      <div ref={sentinelRef} className="h-4" aria-hidden />
      {loadingMore ? <p className="text-xs text-text-secondary text-center">Loading more…</p> : null}
    </div>
  );
}
