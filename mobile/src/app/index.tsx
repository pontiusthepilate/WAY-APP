import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useSession } from "../context/SessionContext";
import { getHasSeenOnboarding } from "../lib/onboarding";
import { colors } from "../theme/theme";

// Entry point: routes to the right place based on session state. Screens
// aren't hard-gated behind this (no auth guard on each route) — fine for
// this MVP where the only way in is through this flow.
export default function Index() {
  const { isSignedIn, activeProfile } = useSession();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    // Only a signed-out visitor can still be mid-first-install — a signed-in
    // one has obviously been through this before, so there's no need to
    // await the AsyncStorage read (and no onboarding flash) on that path.
    if (isSignedIn) return;
    getHasSeenOnboarding().then(setHasSeenOnboarding);
  }, [isSignedIn]);

  if (!isSignedIn && hasSeenOnboarding === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryDark }}>
        <ActivityIndicator color={colors.textOnPrimary} size="large" />
      </View>
    );
  }

  if (!isSignedIn && !hasSeenOnboarding) return <Redirect href="/onboarding" />;
  if (!isSignedIn) return <Redirect href="/welcome" />;
  if (!activeProfile) return <Redirect href="/create-profile" />;
  return <Redirect href="/feed" />;
}
