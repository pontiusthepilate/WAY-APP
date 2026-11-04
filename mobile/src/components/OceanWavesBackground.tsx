import React from "react";
import { StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { colors } from "../theme/theme";
import type { BackgroundTone } from "./SkyOceanBackground";

// Same wash technique as SkyOceanBackground, reused here so a video
// background matches the static-photo tones it sits alongside on other
// screens. Opacities run a bit higher than SkyOceanBackground's photo
// washes — moving, detailed footage (foam, whitecaps) needs more
// flattening than a still photo to keep text legible over it.
const WASH_COLOR: Record<BackgroundTone, string> = {
  pale: colors.background,
  medium: colors.background,
  deep: colors.primaryDark,
};
const WASH_OPACITY: Record<BackgroundTone, number> = {
  pale: 0.35,
  medium: 0.35,
  deep: 0.55,
};

interface Props {
  // A require(...) result — each screen using this picks its own clip.
  source: number;
  tone?: BackgroundTone;
}

export function OceanWavesBackground({ source, tone = "deep" }: Props) {
  const player = useVideoPlayer(source, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="none">
      <VideoView style={StyleSheet.absoluteFill} player={player} contentFit="cover" nativeControls={false} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: WASH_COLOR[tone], opacity: WASH_OPACITY[tone] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Same explicit negative zIndex as SkyOceanBackground, for the same
  // react-native-web TextInput compositing quirk.
  root: { zIndex: -1 },
});
