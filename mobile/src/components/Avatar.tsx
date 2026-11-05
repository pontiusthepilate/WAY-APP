import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/theme";

const RING_WIDTH = 3;

interface Props {
  uri: string | null;
  displayName: string;
  size: number;
  // Draws an illuminated ring (brand gold) when true — the one visual
  // difference from a plain avatar, so passing false/undefined renders
  // identically to before this component existed.
  hasActiveStatus?: boolean;
  onPress?: () => void;
}

export function Avatar({ uri, displayName, size, hasActiveStatus, onPress }: Props) {
  const outerSize = hasActiveStatus ? size + RING_WIDTH * 2 : size;
  const content = (
    <View
      style={[
        styles.ring,
        {
          width: outerSize,
          height: outerSize,
          borderRadius: outerSize / 2,
          borderWidth: hasActiveStatus ? RING_WIDTH : 0,
          borderColor: colors.warning,
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.fallbackText, { fontSize: size * 0.4 }]}>{displayName.charAt(0).toUpperCase()}</Text>
        </View>
      )}
    </View>
  );

  if (!onPress) return content;
  return <Pressable onPress={onPress}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  ring: { alignItems: "center", justifyContent: "center" },
  fallback: { backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  fallbackText: { color: colors.primaryDark, fontWeight: "700" },
});
