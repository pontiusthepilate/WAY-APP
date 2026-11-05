import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, legibleText, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { searchByWayId } from "../api/search";
import { startConversation } from "../api/messages";
import { safeBack } from "../lib/navigation";
import { MiniProfileModal } from "../components/MiniProfileModal";
import type { NearbyResult } from "../types";

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeProfile } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<NearbyResult | null>(null);

  async function handleScanned({ data }: BarcodeScanningResult) {
    if (!scanning || !activeProfile) return;
    setScanning(false);
    setLoading(true);
    setError(null);
    try {
      const results = await searchByWayId({ profileId: activeProfile.id, query: data.trim() });
      if (results[0]) {
        setFound(results[0]);
      } else {
        setError("No WAY found for that code.");
      }
    } catch {
      setError("Couldn't look that up. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function resumeScanning() {
    setFound(null);
    setError(null);
    setScanning(true);
  }

  function openRequest(result: NearbyResult) {
    router.replace({ pathname: "/way-request", params: { toWayId: result.wayId, toDisplayName: result.displayName } });
  }

  function openCameraRequest(result: NearbyResult) {
    router.replace({ pathname: "/request-camera", params: { toWayId: result.wayId, toDisplayName: result.displayName } });
  }

  async function openMessage(result: NearbyResult) {
    if (!activeProfile) return;
    const conversation = await startConversation(activeProfile.id, result.id);
    router.replace(`/messages/${conversation.id}`);
  }

  return (
    <View style={styles.container}>
      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanning ? handleScanned : undefined}
        />
      ) : (
        <View style={styles.permissionPrompt}>
          <Text style={styles.permissionText}>WAY needs camera access to scan a WAY ID code.</Text>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Enable Camera</Text>
          </Pressable>
        </View>
      )}

      <Pressable style={[styles.close, { top: spacing.lg + insets.top }]} onPress={() => safeBack()} hitSlop={12}>
        <Ionicons name="close" size={26} color={colors.textOnPrimary} />
      </Pressable>

      {permission?.granted && (
        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame} />
          <Text style={styles.frameHint}>Point your camera at a WAY ID code</Text>
        </View>
      )}

      {loading && (
        <View style={styles.statusBanner}>
          <ActivityIndicator color={colors.textOnPrimary} />
        </View>
      )}

      {error && !loading && (
        <Pressable style={styles.statusBanner} onPress={resumeScanning}>
          <Text style={styles.statusText}>{error}</Text>
          <Text style={styles.statusHint}>Tap to try again</Text>
        </Pressable>
      )}

      <MiniProfileModal
        result={found}
        onClose={resumeScanning}
        onSendRequest={openRequest}
        onRequestCamera={openCameraRequest}
        onMessage={openMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primaryDark },
  close: {
    position: "absolute",
    left: spacing.lg,
    zIndex: 1,
    padding: spacing.xs,
  },
  frameWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: 240,
    height: 240,
    borderRadius: radii.lg,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  frameHint: { ...typography.body, ...legibleText("onDark"), marginTop: spacing.lg, textAlign: "center", paddingHorizontal: spacing.xl },
  statusBanner: {
    position: "absolute",
    bottom: spacing.xxl,
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: "rgba(6, 46, 56, 0.85)",
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
  },
  statusText: { ...typography.body, color: colors.textOnPrimary, textAlign: "center" },
  statusHint: { ...typography.caption, color: colors.textOnPrimary, opacity: 0.7, marginTop: spacing.xs },
  permissionPrompt: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.xl,
  },
  permissionText: { ...typography.body, color: colors.textOnPrimary, textAlign: "center", marginBottom: spacing.lg },
  permissionButton: {
    backgroundColor: colors.warning,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  permissionButtonText: { color: colors.primaryDark, fontWeight: "700", fontSize: 16 },
});
