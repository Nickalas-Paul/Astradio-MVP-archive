import { API_BASE, api, type ApiError } from './api';
import { getToken } from './token-storage';
import type {
  CommunityComment,
  CommunityLike,
  CommunityPost,
  FeedResponse,
  PostDetailResponse,
  TrendingTagsResponse,
} from '../types/community-feed';

function withUserId(path: string, userId?: string | null): string {
  if (!userId?.trim()) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}userId=${encodeURIComponent(userId.trim())}`;
}

async function parseApiError(response: Response): Promise<ApiError> {
  const data = (await response.json().catch(() => ({}))) as ApiError;
  return {
    ...(typeof data === 'object' && data !== null ? data : {}),
    status: response.status,
  };
}

async function apiFormData<T>(path: string, formData: FormData): Promise<T> {
  const token = await getToken();
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${withUserId(path.startsWith('/') ? path : `/${path}`, null)}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return (await response.json()) as T;
}

export async function fetchFeed(
  offset: number,
  limit: number,
  userId?: string | null
): Promise<FeedResponse> {
  const path = withUserId(
    `/api/community/feed?offset=${offset}&limit=${limit}`,
    userId
  );
  const data = await api<FeedResponse>(path);
  return {
    posts: Array.isArray(data.posts) ? data.posts : [],
    pagination: {
      limit: data.pagination?.limit ?? limit,
      offset: data.pagination?.offset ?? offset,
      total: data.pagination?.total ?? 0,
      hasMore: !!data.pagination?.hasMore,
    },
  };
}

export async function createPost(
  input: { body: string; title?: string; userId: string; pendingImage?: boolean }
): Promise<CommunityPost> {
  return api<CommunityPost>('/api/community/posts', {
    method: 'POST',
    body: JSON.stringify({
      body: input.body,
      title: input.title ?? '',
      userId: input.userId,
      ...(input.pendingImage ? { pendingImage: true } : {}),
    }),
  });
}

export async function uploadPostImage(
  postId: string,
  imageUri: string,
  mimeType: string,
  userId: string
): Promise<CommunityPost> {
  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    type: mimeType,
    name: 'image.jpg',
  } as unknown as Blob);
  formData.append('userId', userId);

  return apiFormData<CommunityPost>(
    withUserId(`/api/community/posts/${encodeURIComponent(postId)}/image`, userId),
    formData
  );
}

export async function likePost(postId: string, userId: string): Promise<CommunityLike> {
  return api<CommunityLike>('/api/community/likes', {
    method: 'POST',
    body: JSON.stringify({ postId, userId }),
  });
}

export async function unlikePost(likeId: string, userId: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(
    withUserId(`/api/community/likes/${encodeURIComponent(likeId)}`, userId),
    { method: 'DELETE', body: JSON.stringify({ userId }) }
  );
}

export async function fetchPost(postId: string, userId?: string | null): Promise<PostDetailResponse> {
  return api<PostDetailResponse>(
    withUserId(`/api/community/posts/${encodeURIComponent(postId)}`, userId)
  );
}

export async function createComment(
  postId: string,
  body: string,
  userId: string
): Promise<CommunityComment> {
  return api<CommunityComment>('/api/community/comments', {
    method: 'POST',
    body: JSON.stringify({ postId, body, userId }),
  });
}

export async function deletePost(postId: string, userId: string): Promise<{ ok?: boolean; deleted?: boolean }> {
  return api<{ ok?: boolean; deleted?: boolean }>(
    `/api/community/posts/${encodeURIComponent(postId)}`,
    {
      method: 'DELETE',
      body: JSON.stringify({ userId }),
    }
  );
}

export async function fetchTrendingTags(limit = 8): Promise<TrendingTagsResponse['tags']> {
  const data = await api<TrendingTagsResponse>(
    `/api/community/tags/trending?limit=${limit}`
  );
  return Array.isArray(data.tags) ? data.tags : [];
}
