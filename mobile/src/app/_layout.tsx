import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { registerGlobals } from "@livekit/react-native";
import { useFonts, Gabarito_600SemiBold, Gabarito_700Bold } from "@expo-google-fonts/gabarito";
import { SessionProvider, useSession } from "../context/SessionContext";
import { usePushRegistration } from "../lib/usePushRegistration";
import { useCallKeep } from "../lib/callKeep";
import { WaterRippleOverlay } from "../components/WaterRippleOverlay";
import { EdgeGlowBorder } from "../components/EdgeGlowBorder";
import { colors } from "../theme/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
registerGlobals();

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // An incoming call gets CallKeep's native ringing UI instead (see
    // lib/callKeep.ts) — showing the regular banner too would double up.
    const isIncomingCall = notification.request.content.data?.type === "incoming_call";
    return {
      shouldShowAlert: !isIncomingCall,
      shouldShowBanner: !isIncomingCall,
      shouldShowList: !isIncomingCall,
      shouldPlaySound: false,
      shouldSetBadge: false,
    };
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Gabarito_600SemiBold, Gabarito_700Bold });

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Gate fontsLoaded={fontsLoaded} />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

function Gate({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { isLoading, activeProfile } = useSession();
  const router = useRouter();
  const ready = fontsLoaded && !isLoading;

  usePushRegistration(activeProfile?.id);
  useCallKeep(activeProfile?.id);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Tapping a notification jumps straight to the relevant screen: a live
  // broadcast, an incoming camera request to review, or a granted session.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string | undefined> | undefined;
      if (data?.liveSessionId) router.push(`/live/${data.liveSessionId}`);
      else if (data?.remoteCameraRequestId) router.push(`/camera-request/${data.remoteCameraRequestId}`);
      else if (data?.remoteCameraSessionId) router.push(`/remote-camera/${data.remoteCameraSessionId}`);
      else if (data?.wayRequestId) router.push(`/way-request/${data.wayRequestId}`);
    });
    return () => sub.remove();
  }, [router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryDark }}>
        <ActivityIndicator color={colors.textOnPrimary} size="large" />
      </View>
    );
  }

  return (
    <>
      <WaterRippleOverlay>
        <Stack screenOptions={{ headerShown: false }} />
      </WaterRippleOverlay>
      <EdgeGlowBorder />
    </>
  );
}
