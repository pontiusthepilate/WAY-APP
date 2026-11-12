import type { Ionicons } from "@expo/vector-icons";

// The same 5 sections (tabs/_layout.tsx) and their routes/titles/icons —
// kept here too so a screen OUTSIDE the tab navigator (a pushed screen like
// wallet-fund.tsx or go-live.tsx, which the Tabs navigator's own tab bar
// never wraps) can still build the same floating nav menu from plain data,
// without needing React Navigation's own tab-bar props.
export interface AppTab {
  name: "feed" | "search" | "messages" | "wallet" | "profile";
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const APP_TABS: AppTab[] = [
  { name: "feed", title: "Feed", icon: "albums-outline" },
  { name: "search", title: "Connect", icon: "radio-outline" },
  { name: "messages", title: "Messages", icon: "chatbubble-outline" },
  { name: "wallet", title: "Wallet", icon: "wallet-outline" },
  { name: "profile", title: "Profile", icon: "person-circle-outline" },
];
