import React, { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { colors, radii } from "../theme/theme";

// A slim outline traces the entire edge of the screen, and three small,
// illuminated points of light glide around it in a slow, endless lap,
// pulsing brighter and dimmer as they travel so they read as something
// alive, like light passing through a tunnel rather than a static painted
// line. Two of the three are the original light (near-white) color; the
// third is an accent dot in the same teal the "Nearby" search tab uses when
// active, so the edge carries a bit of brand color instead of reading as
// purely neutral. Every light pass has a dark (navy) layer of its own too,
// the same halo trick `legibleText` in theme.ts uses for text: whichever one
// actually contrasts with that screen's background is the one that reads,
// so the whole thing stays visible over both the light and dark/photo
// screens in the app without needing to know which screen it's on. Mounted
// once at the root layout, above everything else and pointerEvents="none",
// so it never competes with real content or steals a touch.
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const LAP_DURATION_MS = 105000; // slow, ambient drift
const PULSE_LEG_MS = 2600; // one brighten or dim half-cycle of the "breathing" glow
const DOT_COUNT = 3;
const DOT_LENGTH = 1; // with round caps this draws as a small circle, not a dash
const STROKE_WIDTH = 1.5;
const GLOW_STROKE_WIDTH = 7;
const BLOOM_STROKE_WIDTH = 15;
const LIGHT_COLOR = "#FFF6E6"; // light, airy near-white — two of the three dots
const ACCENT_COLOR = colors.horizonDeep; // the third dot — same teal as the active "Nearby" tab
const DARK_COLOR = colors.primaryDark;

export function EdgeGlowBorder() {
  const { width, height } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const travelLoop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: LAP_DURATION_MS,
        easing: Easing.linear,
        // strokeDashoffset/strokeOpacity aren't transform/opacity View
        // props, so this can't run on the native driver — one float update
        // per frame for a handful of SVG elements is cheap enough that it
        // doesn't need to be.
        useNativeDriver: false,
      })
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: PULSE_LEG_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: PULSE_LEG_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    travelLoop.start();
    pulseLoop.start();
    return () => {
      travelLoop.stop();
      pulseLoop.stop();
    };
  }, [progress, pulse]);

  const inset = BLOOM_STROKE_WIDTH / 2;
  const rectWidth = Math.max(0, width - BLOOM_STROKE_WIDTH);
  const rectHeight = Math.max(0, height - BLOOM_STROKE_WIDTH);
  const perimeter = 2 * (rectWidth + rectHeight);

  // Three dots, evenly spaced: the dash pattern is one dot-sized mark plus a
  // gap sized so the whole pattern repeats exactly DOT_COUNT times around
  // the perimeter, which SVG does automatically for a dasharray shorter
  // than the path.
  const spacing = perimeter / DOT_COUNT;
  const dashArray = `${DOT_LENGTH} ${Math.max(0, spacing - DOT_LENGTH)}`;
  // The accent dot reuses the exact same offset but a dash pattern sized to
  // the full perimeter, so its one mark lands exactly on top of the first
  // of the three light dots rather than repeating alongside them.
  const accentDashArray = `${DOT_LENGTH} ${Math.max(0, perimeter - DOT_LENGTH)}`;

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -perimeter],
  });

  const bloomOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.3] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.55] });
  const coreOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const shadowBloomOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.18] });
  const shadowGlowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.32] });
  const shadowCoreOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.6] });
  const accentBloomOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.38] });
  const accentGlowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.65] });
  const accentCoreOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* The slim edge line itself — light and dark rims stacked, so one of
          them always shows against whatever that screen's background is. */}
      <Rect x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none" stroke={DARK_COLOR} strokeWidth={1} strokeOpacity={0.12} />
      <Rect x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none" stroke={LIGHT_COLOR} strokeWidth={1} strokeOpacity={0.14} />

      {/* Dark shadow passes beneath the light ones, same dash pattern, so
          each dot reads on a light/pale screen too, not just a dark one. */}
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={DARK_COLOR} strokeWidth={BLOOM_STROKE_WIDTH} strokeOpacity={shadowBloomOpacity}
        strokeLinecap="round" strokeDasharray={dashArray} strokeDashoffset={strokeDashoffset}
      />
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={DARK_COLOR} strokeWidth={GLOW_STROKE_WIDTH} strokeOpacity={shadowGlowOpacity}
        strokeLinecap="round" strokeDasharray={dashArray} strokeDashoffset={strokeDashoffset}
      />
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={DARK_COLOR} strokeWidth={STROKE_WIDTH} strokeOpacity={shadowCoreOpacity}
        strokeLinecap="round" strokeDasharray={dashArray} strokeDashoffset={strokeDashoffset}
      />

      {/* The light bloom/glow/core — two of the three dots. */}
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={LIGHT_COLOR} strokeWidth={BLOOM_STROKE_WIDTH} strokeOpacity={bloomOpacity}
        strokeLinecap="round" strokeDasharray={dashArray} strokeDashoffset={strokeDashoffset}
      />
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={LIGHT_COLOR} strokeWidth={GLOW_STROKE_WIDTH} strokeOpacity={glowOpacity}
        strokeLinecap="round" strokeDasharray={dashArray} strokeDashoffset={strokeDashoffset}
      />
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={LIGHT_COLOR} strokeWidth={STROKE_WIDTH} strokeOpacity={coreOpacity}
        strokeLinecap="round" strokeDasharray={dashArray} strokeDashoffset={strokeDashoffset}
      />

      {/* The accent bloom/glow/core — the third dot, overlaid on top of
          where the first light dot already sits. */}
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={ACCENT_COLOR} strokeWidth={BLOOM_STROKE_WIDTH} strokeOpacity={accentBloomOpacity}
        strokeLinecap="round" strokeDasharray={accentDashArray} strokeDashoffset={strokeDashoffset}
      />
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={ACCENT_COLOR} strokeWidth={GLOW_STROKE_WIDTH} strokeOpacity={accentGlowOpacity}
        strokeLinecap="round" strokeDasharray={accentDashArray} strokeDashoffset={strokeDashoffset}
      />
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={ACCENT_COLOR} strokeWidth={STROKE_WIDTH} strokeOpacity={accentCoreOpacity}
        strokeLinecap="round" strokeDasharray={accentDashArray} strokeDashoffset={strokeDashoffset}
      />
    </Svg>
  );
}
