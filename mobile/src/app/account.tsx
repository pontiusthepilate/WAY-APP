import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { safeBack } from "../lib/navigation";
import { PageBackground } from "../components/PageBackground";
import { getMe, deleteAccount, type Me } from "../api/users";
import { ApiError } from "../api/client";

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then(setMe)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load your account."))
      .finally(() => setLoading(false));
  }, []);

  function confirmDelete() {
    Alert.alert(
      "Delete account",
      "This deactivates your account and hides your profiles from search. It can't be undone and you'll need a new phone number or email to sign up again.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: handleDelete },
      ]
    );
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAccount();
      await signOut();
      router.replace("/welcome");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setDeleting(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <PageBackground />
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Account details</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <>
          <Text style={styles.sectionLabel}>Phone</Text>
          <View style={styles.row}>
            <Text style={styles.rowValue}>{me?.phone ?? "Not set"}</Text>
            <Pressable
              style={styles.changeButton}
              onPress={() => router.push({ pathname: "/change-phone", params: { current: me?.phone ?? "" } })}
            >
              <Text style={styles.changeButtonText}>Change</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>Email</Text>
          <View style={styles.row}>
            <Text style={styles.rowValue}>{me?.email ?? "Not set"}</Text>
            <Pressable
              style={styles.changeButton}
              onPress={() => router.push({ pathname: "/change-email", params: { current: me?.email ?? "" } })}
            >
              <Text style={styles.changeButtonText}>Change</Text>
            </Pressable>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Text style={styles.sectionLabel}>Danger zone</Text>
          <Pressable style={styles.deleteButton} onPress={confirmDelete} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <Text style={styles.deleteButtonText}>Delete account</Text>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.md,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: "uppercase",
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  rowValue: { ...typography.body, color: colors.textPrimary, flex: 1 },
  changeButton: { backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  changeButtonText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
  deleteButton: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteButtonText: { color: colors.danger, fontWeight: "700" },
});
