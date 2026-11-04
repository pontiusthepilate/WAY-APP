export interface Profile {
  id: string;
  userId: string;
  wayId: string;
  displayName: string;
  displayPictureUrl: string | null;
  bio: string | null;
  categories: string[];
  kind: "personal" | "business";
  isVerified: boolean;
  followersCount: number;
  followingCount: number;
  isVisible: boolean;
  visibleToNearby: boolean;
  visibleToAddress: boolean;
  visibleToLocation: boolean;
  visibilityText: string | null;
  visibilityImageUrl: string | null;
  actualLat: number | null;
  actualLng: number | null;
  displayLat: number | null;
  displayLng: number | null;
  isLocationOverridden: boolean;
  createdAt: string;
}

export interface NearbyResult {
  id: string;
  wayId: string;
  displayName: string;
  displayPictureUrl: string | null;
  categories: string[];
  visibilityText: string | null;
  visibilityImageUrl: string | null;
  isLocationOverridden: boolean;
  // Absent for a WAY ID / phone lookup result (search/way-id) — that's an
  // exact handle match, not a geo search, so there's no distance or bearing.
  distanceMeters?: number;
  bearingDegrees?: number;
}

export type SearchMode = "nearby" | "address" | "location" | "wayid";
export type ResultView = "radar" | "list" | "grid";

export interface ProfileSummary {
  id: string;
  wayId: string;
  displayName: string;
  displayPictureUrl: string | null;
  isVerified: boolean;
}

export type PostType = "text" | "image" | "video";

export interface Post {
  id: string;
  profileId: string;
  profile: ProfileSummary;
  type: PostType;
  mediaUrl: string | null;
  caption: string | null;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  viewerLiked: boolean;
  viewerReactionType: ReactionType | null;
  createdAt: string;
}

export type ReactionType = "like" | "love" | "haha" | "wow" | "sad" | "angry";

export interface Comment {
  id: string;
  postId: string;
  profileId: string;
  profile: ProfileSummary | null;
  text: string;
  createdAt: string;
}

export type AutoScrollSpeed = "off" | "slow" | "medium" | "fast";

export const CURRENCIES = ["USD", "NGN", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface WalletBalance {
  currency: Currency;
  amount: number; // minor units (cents/kobo)
}

export type TransactionType = "fund" | "transfer_out" | "transfer_in";

export interface Transaction {
  id: string;
  walletId: string;
  groupId: string;
  type: TransactionType;
  currency: Currency;
  amount: number;
  counterpartyProfileId: string | null;
  counterparty: ProfileSummary | null;
  method: "card" | "crypto" | null;
  description: string | null;
  createdAt: string;
}

export type LiveStatus = "scheduled" | "live" | "ended";

export interface LiveSession {
  id: string;
  profileId: string;
  profile: ProfileSummary;
  title: string | null;
  status: LiveStatus;
  scheduledFor: string | null;
  startedAt: string | null;
  endedAt: string | null;
  viewerCount: number;
  createdAt: string;
}

export interface LiveChatMessage {
  id: string;
  liveSessionId: string;
  profileId: string;
  profile: ProfileSummary | null;
  text: string;
  createdAt: string;
}

export type WayRequestStatus = "pending" | "accepted" | "declined";

export interface WayRequest {
  id: string;
  fromProfileId: string;
  toProfileId: string;
  fromProfile: ProfileSummary | null;
  toProfile: ProfileSummary | null;
  text: string | null;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  status: WayRequestStatus;
  createdAt: string;
  respondedAt: string | null;
}

export type RemoteCameraRequestStatus = "pending" | "accepted" | "declined";

export interface RemoteCameraRequest {
  id: string;
  fromProfileId: string;
  toProfileId: string;
  fromProfile: ProfileSummary | null;
  toProfile: ProfileSummary | null;
  message: string | null;
  status: RemoteCameraRequestStatus;
  createdAt: string;
  respondedAt: string | null;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderProfileId: string;
  text: string | null;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  profileAId: string;
  profileBId: string;
  otherProfile: ProfileSummary | null;
  lastMessage: DirectMessage | null;
  lastMessageAt: string;
  createdAt: string;
}

export type NotificationType = "like" | "comment" | "follow" | "way_request" | "camera_request" | "go_live";

export interface AppNotification {
  id: string;
  profileId: string;
  type: NotificationType;
  actorProfileId: string | null;
  actor: ProfileSummary | null;
  postId: string | null;
  read: boolean;
  createdAt: string;
}

export type RemoteCameraSessionStatus = "active" | "ended";

export interface RemoteCameraSession {
  id: string;
  requestId: string;
  granterId: string;
  requesterId: string;
  granter: ProfileSummary | null;
  requester: ProfileSummary | null;
  status: RemoteCameraSessionStatus;
  startedAt: string;
  endedAt: string | null;
}
