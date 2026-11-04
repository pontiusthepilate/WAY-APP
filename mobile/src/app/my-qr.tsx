import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, legibleText, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { safeBack } from "../lib/navigation";
import { SkyOceanBackground } from "../components/SkyOceanBackground";

const QR_SIZE = 220;

export default function MyQrScreen() {
  const { activeProfile } = useSession();
  const insets = useSafeAreaInsets();

  if (!activeProfile) return null;

  return (
    <View style={styles.container}>
      <SkyOceanBackground tone="deep" />

      <Pressable style={[styles.close, { top: spacing.lg + insets.top }]} onPress={() => safeBack()} hitSlop={12}>
        <Ionicons name="close" size={26} color={colors.textOnPrimary} />
      </Pressable>

      <Text style={styles.title}>Your WAY ID</Text>
      <Text style={styles.subtitle}>Let someone scan this to connect with you instantly.</Text>

      <View style={styles.qrCard}>
        <QRCode value={activeProfile.wayId} size={QR_SIZE} color={colors.textPrimary} backgroundColor={colors.surface} />
      </View>

      <Text style={styles.wayId}>WAY/{activeProfile.wayId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  close: {
    position: "absolute",
    left: spacing.lg,
    zIndex: 1,
    padding: spacing.xs,
  },
  title: { ...typography.h1, ...legibleText("onDark"), marginBottom: spacing.sm, textAlign: "center" },
  subtitle: { ...typography.body, ...legibleText("onDark"), opacity: 0.9, textAlign: "center", marginBottom: spacing.xl },
  qrCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  wayId: { ...typography.h3, ...legibleText("onDark"), marginTop: spacing.xl, textAlign: "center" },
});
