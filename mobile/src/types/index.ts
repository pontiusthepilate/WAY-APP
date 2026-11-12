export interface Profile {
  id: string;
  userId: string;
  wayId: string;
  displayName: string;
  displayPictureUrl: string | null;
  bio: string | null;
  // Short, optional "what you do/offer/are into" teaser — shown wherever a
  // profile is previewed and used as search-matchable free text (see
  // the category picker's "Search people matching this description").
  whichWay: string | null;
  categories: string[];
  kind: "personal" | "business" | "podcast";
  isVerified: boolean;
  // One of a small fixed set of permanent, non-interactive profiles
  // (legacy/official accounts auto-followed by every new signup of a
  // matching kind) — no Follow/Unfollow control ever renders for these.
  // defaultLabel is the distinct, human-readable reason shown wherever
  // the profile appears (e.g. "RQ001"), null for every ordinary profile.
  isDefault: boolean;
  defaultLabel: string | null;
  isPrimary: boolean;
  followersCount: number;
  followingCount: number;
  isVisible: boolean;
  visibleToNearby: boolean;
  visibleToAddress: boolean;
  visibleToLocation: boolean;
  visibilityText: string | null;
  visibilityImageUrl: string | null;
  // Can someone who has this account's phone number find this profile at
  // all — the only general/blanket phone-privacy setting. Whether a found
  // or connected profile's actual number is shown is never general; see
  // WayRequest's discoveredVia/fromSharesPhone/toSharesPhone and
  // ProfileViewResult's phoneNumber/sharingMyPhone below.
  discoverableByPhone: boolean;

  // Auto-grant-full-profile-access rules (feature: profile access) —
  // evaluated only for an accepted connector, see profileAccess docs on
  // the backend. Each group is independent and OR'd together.
  autoGrantAccessViaNearby: boolean;
  autoGrantAccessViaAddress: boolean;
  autoGrantAccessViaLocation: boolean;
  autoGrantAccessToPersonal: boolean;
  autoGrantAccessToBusiness: boolean;
  autoGrantAccessToPodcast: boolean;

  messagePrivacy: "everyone" | "following" | "no_one";
  notifyLikes: boolean;
  notifyComments: boolean;
  notifyFollows: boolean;
  notifyMessages: boolean;
  notifyCalls: boolean;
  notifyLive: boolean;
  notifyWayRequests: boolean;
  notifyCameraRequests: boolean;
  notifyProfileAccessRequests: boolean;
  notifyDigest: boolean;
  actualLat: number | null;
  actualLng: number | null;
  displayLat: number | null;
  displayLng: number | null;
  isLocationOverridden: boolean;
  createdAt: string;
}

export interface Status {
  id: string;
  profileId: string;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  caption: string | null;
  backgroundColor: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface NearbyResult {
  id: string;
  wayId: string;
  displayName: string;
  displayPictureUrl: string | null;
  categories: string[];
  whichWay: string | null;
  visibilityText: string | null;
  visibilityImageUrl: string | null;
  isLocationOverridden: boolean;
  // Absent for a WAY ID / phone lookup result (search/way-id) — that's an
  // exact handle match, not a geo search, so there's no distance or bearing.
  distanceMeters?: number;
  bearingDegrees?: number;
}

export type SearchMode = "nearby" | "address" | "location" | "wayid" | "all";

// How a connection was discovered — every SearchMode plus "qr" (scanning a
// QR code isn't a search mode/tab, but is a trackable discovery source for
// WayRequest.discoveredVia).
export type DiscoveredVia = SearchMode | "qr";

// Result of parsing a natural-language search query (see api/search.ts's
// parseSearchQuery) into the same fields the manual search UI produces.
export interface ParsedSearchIntent {
  mode: SearchMode;
  describe: string | null;
  radiusMeters: number | null;
  locationQuery: string | null;
  wayIdQuery: string | null;
  allQuery: string | null;
}
export type ResultView = "radar" | "list" | "grid";

export type ProfileAccessLevel = "full" | "restricted";

// The fixed field subset shown when accessLevel is "restricted" — the same
// fields MiniProfileModal already shows to anyone (see profile/[id].tsx).
export interface RestrictedProfileView {
  id: string;
  wayId: string;
  displayName: string;
  displayPictureUrl: string | null;
  kind: "personal" | "business" | "podcast";
  isVerified: boolean;
  categories: string[];
  whichWay: string | null;
  visibilityText: string | null;
  visibilityImageUrl: string | null;
  isDefault: boolean;
  defaultLabel: string | null;
}

export interface ProfileViewResult {
  accessLevel: ProfileAccessLevel;
  profile: Profile | RestrictedProfileView;
  // isConnected and the three fields below it are all false/null unless
  // there's an actual accepted WayRequest between viewer and owner (never
  // set for access via a ProfileAccessRequest alone, or when viewing your
  // own profile) — isConnected is the one to gate UI on, since an older
  // connection may still have a null discoveredVia. phoneNumber is the
  // owner's number, present only when the owner has shared it with this
  // specific viewer; sharingMyPhone is the viewer's OWN current choice for
  // this connection (what the "Share my phone number with them" toggle on
  // this page reflects/sets — see api/profiles.ts's shareMyPhoneWith).
  isConnected: boolean;
  discoveredVia: DiscoveredVia | null;
  phoneNumber: string | null;
  sharingMyPhone: boolean;
}

// A unified-search result additionally carries its profile kind, to group
// and label people/businesses/podcasts together in one response.
export interface SearchEntityResult extends NearbyResult {
  kind: "personal" | "business" | "podcast";
}

export interface UnifiedSearchResults {
  people: SearchEntityResult[];
  businesses: SearchEntityResult[];
  podcasts: SearchEntityResult[];
  location: { lat: number; lng: number; label: string } | null;
}

export interface ProfileSummary {
  id: string;
  wayId: string;
  displayName: string;
  displayPictureUrl: string | null;
  isVerified: boolean;
}

// A "people you may want to connect with" suggestion (GET
// /way-requests/recommendations/:profileId) — reason is a short,
// rule-based explanation (e.g. "2 mutual connections"), not freeform text.
export interface ConnectRecommendation {
  profile: ProfileSummary & { kind: "personal" | "business" | "podcast" };
  reason: string;
}

// A row in GET /profiles/:id/followers or /following — a profile summary
// plus whether THIS specific relationship is the automatic default-profile
// follow (drives the pinned/"no action" row treatment in the list screen;
// unrelated to the target's own isDefault, which marks the profile itself).
export interface FollowListEntry {
  id: string;
  wayId: string;
  displayName: string;
  displayPictureUrl: string | null;
  kind: "personal" | "business" | "podcast";
  isDefault: boolean;
  defaultLabel: string | null;
  isAutoFollow: boolean;
}

export interface StatusFeedEntry {
  profile: ProfileSummary;
  statusCount: number;
  latestAt: string;
}

export type PostType = "text" | "image" | "video" | "event";

export interface Post {
  id: string;
  profileId: string;
  profile: ProfileSummary;
  // "repost" is never composed directly (see createPost) — it's only ever
  // produced by shareToProfile, so it's not part of PostType.
  type: PostType | "repost";
  mediaUrl: string | null;
  caption: string | null;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  viewerLiked: boolean;
  viewerReactionType: ReactionType | null;
  createdAt: string;
  // A "repost" (type: "repost") has no caption/mediaUrl of its own — render
  // sharedFromPost's content instead (profile-kind cross-profile sharing).
  sharedFromPostId: string | null;
  sharedFromPost: Post | null;
  // Event-only fields (type: "event"). eventLocation is free text — an
  // address, a Google Maps link, a landmark, "online" — not a structured
  // place lookup.
  eventTitle: string | null;
  eventLocation: string | null;
  eventStartsAt: string | null;
  eventCategories: string[];
  // Which kind of media mediaUrl is, for an event post — "event" itself
  // doesn't say, unlike a plain "image"/"video" post's own type field.
  eventMediaType: "image" | "video" | null;
}

export type ReactionType = "like" | "love" | "haha" | "wow" | "sad" | "angry";

export type EpisodeType = "audio" | "video";

// Podcast-profile content (profile-kind feature phase 4) — a separate model
// from Post; only a profile with kind "podcast" can own these.
export type TranscriptStatus = "none" | "pending" | "ready" | "failed";

export interface Episode {
  id: string;
  profileId: string;
  profile: ProfileSummary;
  title: string;
  type: EpisodeType;
  mediaUrl: string;
  coverImageUrl: string | null;
  playsCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewerLiked: boolean;
  createdAt: string;
  transcript: string | null;
  showNotes: string | null;
  transcriptStatus: TranscriptStatus;
}

export interface EpisodeComment {
  id: string;
  episodeId: string;
  profileId: string;
  profile: ProfileSummary | null;
  text: string;
  createdAt: string;
}

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
  // How the sender found the recipient — drives Profile.autoGrantAccessVia*
  // once this request is accepted; null if the client didn't record one.
  discoveredVia: DiscoveredVia | null;
  status: WayRequestStatus;
  createdAt: string;
  respondedAt: string | null;
  // Per-connection phone sharing — each side's own choice to share THEIR
  // number with the other; never a blanket setting. See the backend
  // schema's own doc comment on these two fields.
  fromSharesPhone: boolean;
  toSharesPhone: boolean;
}

export type ProfileAccessRequestStatus = "pending" | "accepted" | "declined";

// Distinct from WayRequest ("Connect") — the escalation sent when the
// mini-profile/restricted view isn't enough and the viewer wants the owner
// to grant full profile access directly (see profile-access-request.tsx).
export interface ProfileAccessRequest {
  id: string;
  fromProfileId: string;
  toProfileId: string;
  fromProfile: ProfileSummary | null;
  toProfile: ProfileSummary | null;
  message: string | null;
  status: ProfileAccessRequestStatus;
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

export interface SupportMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  text: string;
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

export interface Call {
  id: string;
  conversationId: string;
  callerProfileId: string;
  calleeProfileId: string;
  type: "voice" | "video";
  status: "ringing" | "accepted" | "declined" | "missed" | "ended";
  roomName: string;
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
}

export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "way_request"
  | "way_request_accepted"
  | "way_request_declined"
  | "camera_request"
  | "go_live"
  | "profile_access_request"
  | "profile_access_response";

export interface AppNotification {
  id: string;
  profileId: string;
  type: NotificationType;
  actorProfileId: string | null;
  actor: ProfileSummary | null;
  postId: string | null;
  episodeId: string | null;
  profileAccessRequestId: string | null;
  wayRequestId: string | null;
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
