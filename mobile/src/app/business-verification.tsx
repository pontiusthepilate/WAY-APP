import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { PageBackgroundVideo } from "../components/PageBackgroundVideo";
import { useSession } from "../context/SessionContext";
import { getMyBusinessVerification, type BusinessVerificationRequest } from "../api/businessVerification";
import { ApiError } from "../api/client";
import { safeBack } from "../lib/navigation";

const STATUS_LABEL: Record<BusinessVerificationRequest["status"], string> = {
  pending: "Under review",
  verified: "Verified",
  rejected: "Not approved",
};

export default function BusinessVerificationStatusScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeProfile } = useSession();
  const [request, setRequest] = useState<BusinessVerificationRequest | null | undefined>(undefined);

  const load = useCallback(() => {
    if (!activeProfile) return;
    getMyBusinessVerification(activeProfile.id)
      .then(setRequest)
      .catch((err) => setRequest(err instanceof ApiError && err.status === 404 ? null : undefined));
  }, [activeProfile]);

  useFocusEffect(load);

  if (!activeProfile) return null;

  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <PageBackgroundVideo />
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Business verification</Text>
        <View style={{ width: 24 }} />
      </View>

      {request === undefined ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : request === null ? (
        <View style={styles.card}>
          <Ionicons name="shield-checkmark-outline" size={32} color={colors.textSecondary} />
          <Text style={styles.cardTitle}>Get verified</Text>
          <Text style={styles.cardBody}>
            Submit your business registration details to get the verified badge on your profile.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push("/business-verification-submit")}>
            <Text style={styles.primaryButtonText}>Start verification</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={[styles.statusBadge, styles[`statusBadge_${request.status}`]]}>
            <Text style={styles.statusBadgeText}>{STATUS_LABEL[request.status]}</Text>
          </View>
          <Text style={styles.cardTitle}>RC {request.rcNumber}</Text>

          {request.status === "pending" && (
            <>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, (request.daysElapsed / request.slaDays) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>
                Day {Math.min(request.slaDays, Math.ceil(request.daysElapsed))} of {request.slaDays} — we aim to
                respond within {request.slaDays} days.
              </Text>
            </>
          )}

          {request.status === "verified" && (
            <Text style={styles.cardBody}>Your business is verified. The badge now shows on your profile.</Text>
          )}

          {request.status === "rejected" && (
            <>
              <Text style={styles.cardBody}>{request.rejectionReason}</Text>
              <Pressable style={styles.primaryButton} onPress={() => router.push("/business-verification-submit")}>
                <Text style={styles.primaryButtonText}>Resubmit</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: spacing.lg },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  loading: { marginTop: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.lg, alignItems: "flex-start", gap: spacing.sm },
  cardTitle: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.xs },
  cardBody: { ...typography.body, color: colors.textSecondary },
  statusBadge: { borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  statusBadge_pending: { backgroundColor: colors.surfaceAlt },
  statusBadge_verified: { backgroundColor: colors.primary },
  statusBadge_rejected: { backgroundColor: colors.danger },
  statusBadgeText: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 12 },
  progressTrack: { width: "100%", height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 4 },
  progressLabel: { ...typography.caption, color: colors.textSecondary },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.xs },
  primaryButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
});
