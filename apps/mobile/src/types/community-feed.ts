export type CommunityAuthor = {
  displayName?: string | null;
  handle?: string | null;
  avatarUrl?: string | null;
};

export type CommunityPost = {
  id: string;
  userId: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  audioExportId?: string | null;
  audioLabel?: string | null;
  moderationStatus: string;
  createdAt: string;
  updatedAt: string;
  author?: CommunityAuthor;
  likeCount: number;
  commentCount: number;
  likedByViewer: boolean;
  viewerLikeId?: string | null;
  hashtags: string[];
};

export type CommunityComment = {
  id: string;
  postId: string;
  userId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author?: CommunityAuthor;
};

export type FeedPagination = {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
};

export type FeedResponse = {
  posts: CommunityPost[];
  pagination: FeedPagination;
};

export type TrendingTag = {
  tag: string;
  post_count: number;
  lastUsedAt?: string;
};

export type TrendingTagsResponse = {
  tags: TrendingTag[];
};

export type CommunityLike = {
  id: string;
  userId: string;
  postId: string;
  createdAt: string;
};

export type PostDetailResponse = CommunityPost & {
  comments: CommunityComment[];
};
