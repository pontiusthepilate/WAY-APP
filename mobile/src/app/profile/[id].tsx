import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../theme/theme";
import { useSession } from "../../context/SessionContext";
import { getProfileView } from "../../api/profiles";
import { Avatar } from "../../components/Avatar";
import { FollowButton } from "../../components/FollowButton";
import { PageBackground } from "../../components/PageBackground";
import { formatProfileHandle } from "../../lib/profileHandle";
import { safeBack } from "../../lib/navigation";
import type { Profile, ProfileViewResult, RestrictedProfileView, SearchMode } from "../../types";

const KIND_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  business: "shield-checkmark-outline",
  podcast: "mic-outline",
};

function isFullProfile(profile: Profile | RestrictedProfileView): profile is Profile {
  return "bio" in profile;
}

// The gated full-profile page (feature: profile access) — reachable from
// MiniProfileModal's "View Profile" button whether or not the viewer
// currently has full access. Renders the restricted (mini-profile-
// equivalent) or full field set depending on what GET /profiles/:id
// returns, computed server-side by computeProfileAccessLevel.
export default function ProfilePageScreen() {
  const { id, discoveredVia } = useLocalSearchParams<{ id: string; discoveredVia?: SearchMode }>();
  const { activeProfile } = useSession();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [view, setView] = useState<ProfileViewResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!id || !activeProfile) return;
    setLoading(true);
    getProfileView(id, activeProfile.id)
      .then(setView)
      .catch(() => setView(null))
      .finally(() => setLoading(false));
  }, [id, activeProfile]);

  useFocusEffect(load);

  function openConnect() {
    if (!view) return;
    router.push({
      pathname: "/way-request",
      params: { toWayId: view.profile.wayId, toDisplayName: view.profile.displayName, discoveredVia },
    });
  }

  function openRequestAccess() {
    if (!view) return;
    router.push({
      pathname: "/profile-access-request",
      params: { toWayId: view.profile.wayId, toDisplayName: view.profile.displayName },
    });
  }

  if (loading || !view || !activeProfile) {
    return (
      <View style={styles.centered}>
        <PageBackground />
        <ActivityIndicator color={colors.primaryDark} />
      </View>
    );
  }

  const { accessLevel, profile } = view;
  const isSelf = profile.id === activeProfile.id;
  const isDefault = profile.isDefault;

  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <PageBackground />
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.centeredContent}>
        <Avatar uri={profile.displayPictureUrl} displayName={profile.displayName} size={86} />

        <View style={styles.nameRow}>
          <Text style={styles.name}>{profile.displayName}</Text>
          {KIND_ICON[profile.kind] && (
            <Ionicons name={KIND_ICON[profile.kind]} size={18} color={colors.primaryDark} style={styles.kindIcon} />
          )}
        </View>
        <Text style={styles.way}>{formatProfileHandle({ wayId: profile.wayId, isDefault })}</Text>
        {isDefault && profile.defaultLabel && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>{profile.defaultLabel}</Text>
          </View>
        )}

        {!isSelf && !isDefault && (
          <View style={styles.followRow}>
            <FollowButton targetProfileId={profile.id} />
          </View>
        )}

        {profile.whichWay && (
          <View style={styles.whichWayBox}>
            <Text style={styles.whichWayText}>{profile.whichWay}</Text>
          </View>
        )}

        {isFullProfile(profile) && (
          <View style={styles.statsRow}>
            <Pressable style={styles.stat} onPress={() => router.push(`/followers/${profile.id}`)}>
              <Text style={styles.statValue}>{profile.followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </Pressable>
            <Pressable style={styles.stat} onPress={() => router.push(`/following/${profile.id}`)}>
              <Text style={styles.statValue}>{profile.followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </Pressable>
          </View>
        )}

        {isFullProfile(profile) && profile.bio && (
          <View style={styles.bioBox}>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {profile.categories.length > 0 && (
          <View style={styles.chipsRow}>
            {profile.categories.map((c) => (
              <View key={c} style={styles.chip}>
                <Text style={styles.chipText}>{c}</Text>
              </View>
            ))}
          </View>
        )}

        {accessLevel === "restricted" && !isSelf && !isDefault && (
          <Text style={styles.restrictedNotice}>
            You&apos;re seeing a limited view of this profile. Connect, or request full access, to see more.
          </Text>
        )}

        {!isSelf && !isDefault && (
          <>
            <Pressable style={styles.connectButton} onPress={openConnect}>
              <Text style={styles.connectButtonText}>Connect</Text>
            </Pressable>
            {accessLevel === "restricted" && (
              <Pressable style={styles.requestAccessButton} onPress={openRequestAccess}>
                <Text style={styles.requestAccessButtonText}>Request Full Profile Access</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.lg,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  centeredContent: { alignItems: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md },
  name: { ...typography.h2, color: colors.textPrimary },
  kindIcon: {},
  way: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
  defaultBadge: {
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  defaultBadgeText: { ...typography.caption, color: colors.primaryDark, fontWeight: "700" },
  followRow: { marginTop: spacing.sm },
  whichWayBox: { marginTop: spacing.sm, paddingHorizontal: spacing.md },
  whichWayText: { ...typography.body, color: colors.textPrimary, textAlign: "center" },
  statsRow: { flexDirection: "row", marginTop: spacing.md, gap: spacing.lg },
  stat: { alignItems: "center" },
  statValue: { ...typography.h3, color: colors.textPrimary },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  bioBox: { marginTop: spacing.md, width: "100%" },
  bioText: { ...typography.body, color: colors.textPrimary, textAlign: "center" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.xs, marginTop: spacing.md },
  chip: { backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, paddingVertical: 4, paddingHorizontal: spacing.sm },
  chipText: { ...typography.caption, color: colors.primaryDark, fontWeight: "600" },
  restrictedNotice: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  connectButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    width: "100%",
    alignItems: "center",
  },
  connectButtonText: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 16 },
  requestAccessButton: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    width: "100%",
    alignItems: "center",
  },
  requestAccessButtonText: { color: colors.primaryDark, fontWeight: "700", fontSize: 16 },
});
