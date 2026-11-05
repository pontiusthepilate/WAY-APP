import React, { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { colors } from "../theme/theme";
import { PAGE_BACKGROUNDS } from "./pageBackgroundManifest";

// Fills a plain-background screen with one randomly shuffled photo from the
// curated pool, faint behind a wash so content stays legible. Each entry's
// washOpacity was computed from that photo's own brightness (see
// pageBackgroundManifest.ts) so a dark photo and a pale one end up looking
// equally muted here instead of one drowning the content and the other
// barely showing.
export function PageBackground() {
  const [entry] = useState(() => PAGE_BACKGROUNDS[Math.floor(Math.random() * PAGE_BACKGROUNDS.length)]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* width/height: "100%" alongside absoluteFill — without it, a local
          require()'d image's own pixel dimensions win and it renders at its
          native aspect ratio instead of stretching to cover the screen. */}
      <Image
        source={entry.source}
        style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
        resizeMode="cover"
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: entry.washOpacity }]} />
    </View>
  );
}
