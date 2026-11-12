import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FloatingNavPanel, type PanelTab } from "./CollapsibleTabBar";
import { APP_TABS } from "../lib/appTabs";

// The one floating arrow + slide-up menu for the whole app — mounted once
// at the root (see app/_layout.tsx), not per-screen, so it's there on every
// route once someone's signed in: tab screens AND pushed sub-screens alike
// (wallet-fund, go-live, privacy, …). A real Modal (category picker, map
// picker, address sheet, …) naturally paints over it in its own layer while
// open, so it already reads as hidden "during a pop-up" with no special-
// casing needed here. Replaces the current route (rather than pushing on
// top of it) so picking a tab never leaves the screen you tapped away from
// buried in history underneath it.
export function GlobalNavPanel() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const tabs: PanelTab[] = APP_TABS.map((tab) => ({
    key: tab.name,
    label: tab.title,
    // Only the tab's own root screen counts as "focused" — a deeper route
    // (e.g. /profile/abc123) is a genuinely different screen with its own
    // back button, not the tab root itself.
    focused: pathname === `/${tab.name}`,
    icon: ({ color, size }) => <Ionicons name={tab.icon} size={size} color={color} />,
    onPress: () => router.replace(`/${tab.name}` as never),
  }));

  return <FloatingNavPanel tabs={tabs} insets={insets} />;
}
