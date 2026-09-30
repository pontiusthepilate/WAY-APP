import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { follow, getFollowStatus, unfollow } from "../api/follow";

export function FollowButton({ targetProfileId }: { targetProfileId: string }) {
  const { activeProfile } = useSession();
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeProfile || activeProfile.id === targetProfileId) return;
    getFollowStatus(targetProfileId, activeProfile.id)
      .then((r) => setIsFollowing(r.following))
      .catch(() => setIsFollowing(false));
  }, [activeProfile, targetProfileId]);

  if (!activeProfile || activeProfile.id === targetProfileId || isFollowing === null) return null;

  async function handlePress() {
    if (!activeProfile) return;
    setLoading(true);
    try {
      if (isFollowing) {
        await unfollow(targetProfileId, activeProfile.id);
        setIsFollowing(false);
      } else {
        await follow(targetProfileId, activeProfile.id);
        setIsFollowing(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Pressable style={[styles.button, isFollowing && styles.buttonFollowing]} onPress={handlePress} disabled={loading}>
      {loading ? (
        <ActivityIndicator color={isFollowing ? colors.primaryDark : colors.textOnPrimary} size="small" />
      ) : (
        <Text style={[styles.label, isFollowing && styles.labelFollowing]}>{isFollowing ? "Following" : "Follow"}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 110,
  },
  buttonFollowing: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  label: { ...typography.body, fontWeight: "700", color: colors.textOnPrimary },
  labelFollowing: { color: colors.textPrimary },
});
