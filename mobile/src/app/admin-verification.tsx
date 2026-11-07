import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { PageBackgroundVideo } from "../components/PageBackgroundVideo";
import {
  listVerificationRequests,
  decideVerificationRequest,
  type AdminVerificationRequest,
} from "../api/adminVerification";
import type { VerificationStatus } from "../api/businessVerification";
import { Avatar } from "../components/Avatar";
import { safeBack } from "../lib/navigation";

const SECRET_STORAGE_KEY = "way.admin.secret";
const STATUS_FILTERS: (VerificationStatus | "all")[] = ["pending", "verified", "rejected", "all"];

export default function AdminVerificationScreen() {
  const insets = useSafeAreaInsets();
  const [secret, setSecret] = useState<string | null | undefined>(undefined);
  const [secretInput, setSecretInput] = useState("");
  const [tab, setTab] = useState<"firstTime" | "resubmissions">("firstTime");
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | "all">("pending");
  const [requests, setRequests] = useState<AdminVerificationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    AsyncStorage.getItem(SECRET_STORAGE_KEY).then((v) => setSecret(v));
  }, []);

  const load = useCallback(() => {
    if (!secret) return;
    setLoading(true);
    setError(null);
    listVerificationRequests(secret, {
      isResubmission: tab === "resubmissions",
      status: statusFilter === "all" ? undefined : statusFilter,
    })
      .then(setRequests)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load requests"))
      .finally(() => setLoading(false));
  }, [secret, tab, statusFilter]);

  useFocusEffect(load);

  async function handleSaveSecret() {
    if (!secretInput.trim()) return;
    await AsyncStorage.setItem(SECRET_STORAGE_KEY, secretInput.trim());
    setSecret(secretInput.trim());
  }

  async function handleVerify(id: string) {
    if (!secret) return;
    await decideVerificationRequest(secret, id, { decision: "verified" });
    load();
  }

  async function handleReject(id: string) {
    if (!secret || !rejectReason.trim()) return;
    await decideVerificationRequest(secret, id, { decision: "rejected", rejectionReason: rejectReason.trim() });
    setRejectingId(null);
    setRejectReason("");
    load();
  }

  if (secret === undefined) return null;

  if (!secret) {
    return (
      <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <PageBackgroundVideo />
        <Text style={styles.headerTitle}>Admin access</Text>
        <Text style={styles.label}>Enter the X-Admin-Secret value from backend/.env</Text>
        <TextInput
          style={styles.input}
          value={secretInput}
          onChangeText={setSecretInput}
          placeholder="Admin secret"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          autoCapitalize="none"
        />
        <Pressable style={styles.primaryButton} onPress={handleSaveSecret}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <PageBackgroundVideo />
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Verification queue</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabRow}>
        <Pressable style={[styles.tab, tab === "firstTime" && styles.tabActive]} onPress={() => setTab("firstTime")}>
          <Text style={[styles.tabText, tab === "firstTime" && styles.tabTextActive]}>First-time</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === "resubmissions" && styles.tabActive]} onPress={() => setTab("resubmissions")}>
          <Text style={[styles.tabText, tab === "resubmissions" && styles.tabTextActive]}>
            Resubmissions
          </Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((s) => (
          <Pressable key={s} style={[styles.filterChip, statusFilter === s && styles.filterChipActive]} onPress={() => setStatusFilter(s)}>
            <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.listPadding}
          ListEmptyComponent={<Text style={styles.empty}>Nothing here.</Text>}
          renderItem={({ item }) => {
            const lookup = item.lookupResult as { companyName?: string; status?: string } | null;
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Avatar uri={item.profile?.displayPictureUrl ?? null} displayName={item.profile?.displayName ?? "?"} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{item.profile?.displayName ?? "Unknown"}</Text>
                    <Text style={styles.cardSub}>WAY/{item.profile?.wayId}</Text>
                  </View>
                  {item.isOverdue && (
                    <View style={styles.overdueBadge}>
                      <Text style={styles.overdueBadgeText}>Overdue</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.cardLine}>
                  RC {item.rcNumber} · {item.companyType}
                </Text>
                {lookup?.companyName && (
                  <Text style={styles.cardLineMuted}>
                    Registry: {lookup.companyName} — {lookup.status} ({item.lookupSource})
                  </Text>
                )}
                <Text style={styles.cardLineMuted}>
                  Day {Math.min(item.slaDays, Math.ceil(item.daysElapsed))} of {item.slaDays}
                  {item.isResubmission ? " · resubmission" : ""}
                </Text>

                {item.status === "pending" && (
                  <>
                    <View style={styles.actionsRow}>
                      <Pressable style={styles.verifyButton} onPress={() => handleVerify(item.id)}>
                        <Text style={styles.verifyButtonText}>Verify</Text>
                      </Pressable>
                      <Pressable
                        style={styles.rejectButton}
                        onPress={() => setRejectingId(rejectingId === item.id ? null : item.id)}
                      >
                        <Text style={styles.rejectButtonText}>Reject</Text>
                      </Pressable>
                    </View>
                    {rejectingId === item.id && (
                      <View style={styles.rejectRow}>
                        <TextInput
                          style={styles.rejectInput}
                          value={rejectReason}
                          onChangeText={setRejectReason}
                          placeholder="Reason shown to the business"
                          placeholderTextColor={colors.textSecondary}
                          multiline
                        />
                        <Pressable style={styles.verifyButton} onPress={() => handleReject(item.id)} disabled={!rejectReason.trim()}>
                          <Text style={styles.verifyButtonText}>Confirm</Text>
                        </Pressable>
                      </View>
                    )}
                  </>
                )}
                {item.status !== "pending" && (
                  <Text style={styles.decidedLine}>
                    {item.status === "verified" ? "Verified" : `Rejected: ${item.rejectionReason}`}
                  </Text>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: spacing.md },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  label: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primaryButton: { marginTop: spacing.lg, backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: spacing.sm, alignItems: "center" },
  primaryButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  tabRow: { flexDirection: "row", backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, padding: 4, marginBottom: spacing.sm },
  tab: { flex: 1, borderRadius: radii.pill, paddingVertical: spacing.xs, alignItems: "center" },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...typography.caption, color: colors.textSecondary, fontWeight: "700" },
  tabTextActive: { color: colors.textOnPrimary },
  filterRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
  filterChip: { borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { ...typography.caption, color: colors.textPrimary },
  filterChipTextActive: { color: colors.textOnPrimary },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  listPadding: { paddingBottom: spacing.xl },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm, gap: 4 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 4 },
  cardName: { ...typography.body, color: colors.textPrimary, fontWeight: "700" },
  cardSub: { ...typography.caption, color: colors.textSecondary },
  cardLine: { ...typography.body, color: colors.textPrimary },
  cardLineMuted: { ...typography.caption, color: colors.textSecondary },
  overdueBadge: { backgroundColor: colors.danger, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  overdueBadgeText: { color: colors.textOnPrimary, fontSize: 11, fontWeight: "700" },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  verifyButton: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  verifyButtonText: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 13 },
  rejectButton: { backgroundColor: colors.danger, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  rejectButtonText: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 13 },
  rejectRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, alignItems: "flex-end" },
  rejectInput: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radii.sm, padding: spacing.sm, ...typography.caption, color: colors.textPrimary, minHeight: 40 },
  decidedLine: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, fontStyle: "italic" },
});
