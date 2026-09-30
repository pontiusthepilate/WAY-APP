import { api } from "./client";
import type { Comment, Post, PostType } from "../types";

interface FeedPage {
  posts: Post[];
  nextCursor: string | null;
}

function qs(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export function getPost(id: string, viewerProfileId?: string) {
  return api.get<Post>(`/posts/${id}${qs({ viewerProfileId })}`);
}

export function getFeed(input: { viewerProfileId: string; cursor?: string; limit?: number }) {
  return api.get<FeedPage>(`/posts/feed${qs(input)}`);
}

export function getProfilePosts(profileId: string, input: { viewerProfileId: string; cursor?: string; limit?: number }) {
  return api.get<FeedPage>(`/profiles/${profileId}/posts${qs(input)}`);
}

export function createPost(input: { profileId: string; type: PostType; mediaUrl?: string; caption?: string }) {
  return api.post<Post>("/posts", input);
}

export function deletePost(id: string) {
  return api.del(`/posts/${id}`);
}

export function toggleLike(postId: string, profileId: string) {
  return api.post<{ liked: boolean; likesCount: number }>(`/posts/${postId}/like`, { profileId });
}

export function registerView(postId: string) {
  return api.post<{ viewsCount: number }>(`/posts/${postId}/view`);
}

export function registerShare(postId: string) {
  return api.post<{ sharesCount: number }>(`/posts/${postId}/share`);
}

export function getComments(postId: string, cursor?: string) {
  return api.get<Comment[]>(`/posts/${postId}/comments${qs({ cursor })}`);
}

export function addComment(postId: string, input: { profileId: string; text: string }) {
  return api.post<Comment>(`/posts/${postId}/comments`, input);
}
