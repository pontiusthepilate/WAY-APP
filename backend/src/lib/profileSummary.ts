// The subset of a Profile safe to embed in another resource's response
// (post author, comment author, transaction counterparty, live broadcaster).
export const PROFILE_SUMMARY_SELECT = {
  id: true,
  wayId: true,
  displayName: true,
  displayPictureUrl: true,
  isVerified: true,
} as const;
