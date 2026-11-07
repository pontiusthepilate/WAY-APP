import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { colors } from "../theme/theme";

// The video counterpart to PageBackground (photos) — fills a plain-
// background screen with one of the existing looping ocean-wave clips
// (already used on welcome/onboarding/otp/my-qr) instead of a static photo.
//
// Deliberately does NOT reuse OceanWavesBackground here: that component's
// root view sets zIndex: -1 (a react-native-web-only compositing fix per
// its own comment), which on native iOS renders it behind these screens'
// own opaque container backgroundColor, hiding the video entirely. Plain
// stacking order — this as the first child, like PageBackground — is all
// that's needed on screens that aren't fighting that web quirk.
const VIDEO_SOURCES = [
  require("../../assets/ocean-waves-welcome.mp4"),
  require("../../assets/onboarding-waves.mp4"),
  require("../../assets/otp-waves.mp4"),
  require("../../assets/my-qr-waves.mp4"),
];

export function PageBackgroundVideo() {
  const [source] = useState(() => VIDEO_SOURCES[Math.floor(Math.random() * VIDEO_SOURCES.length)]);
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView style={StyleSheet.absoluteFill} player={player} contentFit="cover" nativeControls={false} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: 0.35 }]} />
    </View>
  );
}
