import React from "react";
import { StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { colors } from "../theme/theme";

// Short looping aerial ocean-waves clip (Pexels, free license — Siarhei
// Nester), re-encoded down from a 73MB/1440x2560/60fps source to ~3.4MB
// (640x1138/24fps, muted, h264) since it ships inside the app bundle.
const VIDEO_SOURCE = require("../../assets/ocean-waves-welcome.mp4");

// Same wash technique as SkyOceanBackground's "deep" tone: a translucent
// layer of the brand teal over the footage so it reads as WAY's own
// backdrop (not raw stock footage) and keeps the light welcome-screen text
// legible over the high-contrast foam/water.
const WASH_COLOR = colors.primaryDark;
const WASH_OPACITY = 0.55;

export function OceanWavesBackground() {
  const player = useVideoPlayer(VIDEO_SOURCE, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="none">
      <VideoView style={StyleSheet.absoluteFill} player={player} contentFit="cover" nativeControls={false} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: WASH_COLOR, opacity: WASH_OPACITY }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Same explicit negative zIndex as SkyOceanBackground, for the same
  // react-native-web TextInput compositing quirk.
  root: { zIndex: -1 },
});
