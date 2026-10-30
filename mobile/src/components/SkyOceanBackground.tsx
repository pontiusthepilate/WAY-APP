import React, { useEffect, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import Svg, { Ellipse, Path } from "react-native-svg";
import { colors } from "../theme/theme";

// The brand's "sky meets the ocean" motif: a real photo per tone (sourced
// from Unsplash, free license) as the backdrop, with a translucent wash on
// top to keep it out of the way behind dense, text-heavy screens — and
// drifting cloud/water accents layered over everything for continuous,
// lightweight motion (transform-only, native-driven, so it costs nothing on
// the JS thread once started).
export type BackgroundTone = "pale" | "medium" | "deep";

const PHOTOS: Record<BackgroundTone, number> = {
  // Calm, pale horizon — stays out of the way behind dense content/forms.
  pale: require("../../assets/sky-ocean-pale.jpg"),
  // A breaking wave under a pale sky — more presence for lighter screens.
  medium: require("../../assets/sky-ocean-medium.jpg"),
  // Rich teal sea-foam texture — full presence for quiet hero screens.
  deep: require("../../assets/sky-ocean-deep.jpg"),
};

// A wash sits over the photo so text stays legible instead of fighting a
// busy image underneath. Pale/medium screens use dark text, so they need a
// *light* wash; deep screens (welcome/auth) use light text over the photo,
// so that needs a *dark* wash instead — same idea, opposite direction.
const WASH_COLOR: Record<BackgroundTone, string> = {
  pale: colors.background,
  medium: colors.background,
  deep: colors.primaryDark,
};
const WASH_OPACITY: Record<BackgroundTone, number> = {
  pale: 0.82,
  medium: 0.55,
  deep: 0.45,
};

interface Props {
  tone?: BackgroundTone;
  // Lets a screen opt out of the drift (e.g. to save a few animated frames
  // behind something already busy, like a camera preview).
  animated?: boolean;
}

// A slow back-and-forth drift on a single Animated.Value, transform-only and
// native-driven so it costs nothing on the JS thread once started — this is
// what keeps "continuously moving sky/clouds/water" cheap enough to leave
// running behind every screen.
function useDrift(durationMs: number, range: number, reverse = false) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: durationMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress, durationMs]);

  return progress.interpolate({
    inputRange: [0, 1],
    outputRange: reverse ? [range, -range] : [-range, range],
  });
}

export function SkyOceanBackground({ tone = "pale", animated = true }: Props) {
  // Independent, differently-timed drifts so the motion reads as organic
  // rather than everything sliding in lockstep.
  const cloudA = useDrift(16000, 6);
  const cloudB = useDrift(21000, 5, true);
  const waterNear = useDrift(10000, 3);
  const waterFar = useDrift(14000, 2.2, true);

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="none">
      <Image source={PHOTOS[tone]} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: WASH_COLOR[tone], opacity: WASH_OPACITY[tone] }]} />

      {animated && (
        <>
          <Animated.View style={[styles.cloudWrap, { top: "10%", left: "8%", transform: [{ translateX: cloudA }] }]}>
            <Svg width={140} height={48} viewBox="0 0 140 48">
              <Ellipse cx={55} cy={28} rx={42} ry={14} fill="#FFFFFF" fillOpacity={0.28} />
              <Ellipse cx={85} cy={20} rx={48} ry={17} fill="#FFFFFF" fillOpacity={0.3} />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.cloudWrap, { top: "18%", left: "52%", transform: [{ translateX: cloudB }] }]}>
            <Svg width={105} height={36} viewBox="0 0 105 36">
              <Ellipse cx={38} cy={20} rx={30} ry={10} fill="#FFFFFF" fillOpacity={0.2} />
              <Ellipse cx={62} cy={15} rx={34} ry={12} fill="#FFFFFF" fillOpacity={0.22} />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.waterWrap, { bottom: "9%", transform: [{ translateX: waterFar }] }]}>
            <Svg width="140%" height={14} viewBox="0 0 400 14" preserveAspectRatio="none">
              <Path
                d="M0,7 Q50,2 100,7 T200,7 T300,7 T400,7"
                stroke={colors.horizon}
                strokeOpacity={0.16}
                strokeWidth={1.2}
                fill="none"
              />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.waterWrap, { bottom: "5%", transform: [{ translateX: waterNear }] }]}>
            <Svg width="140%" height={16} viewBox="0 0 400 16" preserveAspectRatio="none">
              <Path
                d="M0,8 Q50,1 100,8 T200,8 T300,8 T400,8"
                stroke={colors.horizon}
                strokeOpacity={0.3}
                strokeWidth={1.5}
                fill="none"
              />
            </Svg>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Explicit negative zIndex rather than relying on DOM/paint order — on
  // react-native-web, a transformed sibling (the drifting clouds/water
  // below) can otherwise make a native form control (TextInput) nearby fail
  // to composite correctly, leaving it invisible despite being "on top" by
  // source order.
  root: { zIndex: -1 },
  cloudWrap: { position: "absolute" },
  waterWrap: { position: "absolute", left: "-10%", right: "-10%" },
});
