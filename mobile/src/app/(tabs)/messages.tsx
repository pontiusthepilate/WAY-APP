import React, { useCallback, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, radii, spacing, typography } from "../../theme/theme";
import { useSession } from "../../context/SessionContext";
import { getConversations } from "../../api/messages";
import { SkyOceanBackground } from "../../components/SkyOceanBackground";
import type { Conversation } from "../../types";

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeProfile } = useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const load = useCallback(async () => {
    if (!activeProfile) return;
    try {
      setConversations(await getConversations(activeProfile.id));
    } catch {
      // keep whatever was already on screen; next focus will retry
    }
  }, [activeProfile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <SkyOceanBackground tone="pale" />
      <View style={[styles.header, { paddingTop: spacing.lg + insets.top }]}>
        <Image source={require("../../../assets/way-mark.png")} style={styles.headerLogo} resizeMode="contain" />
        <Text style={styles.title}>Messages</Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.listPadding}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/messages/${item.id}`)}>
            {item.otherProfile?.displayPictureUrl ? (
              <Image source={{ uri: item.otherProfile.displayPictureUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{(item.otherProfile?.displayName ?? "?").charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.rowText}>
              <Text style={styles.name}>{item.otherProfile?.displayName ?? "Unknown"}</Text>
              <Text style={styles.preview} numberOfLines={1}>
                {item.lastMessage?.text ?? (item.lastMessage?.mediaUrl ? "📷 Photo" : "Say hello")}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No conversations yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerLogo: { width: 52, height: 52, marginBottom: 2 },
  title: { ...typography.h1, color: colors.primaryDark },
  listPadding: { paddingBottom: 110, paddingHorizontal: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  avatar: { width: 52, height: 52, borderRadius: radii.pill, backgroundColor: colors.primaryLight },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.primaryDark, fontWeight: "700", fontSize: 18 },
  rowText: { flex: 1 },
  name: { ...typography.body, color: colors.textPrimary, fontWeight: "700" },
  preview: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
