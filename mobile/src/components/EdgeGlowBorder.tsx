import React, { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { colors, radii } from "../theme/theme";

// A slim outline traces the entire edge of the screen, and three comets —
// a bright head with a fading tail — glide around it in a slow, endless lap,
// pulsing brighter and dimmer as they travel so they read as something
// alive, like light passing through a tunnel rather than a static painted
// line. Every pass has a light (near-white) layer AND a dark (navy) layer of
// its own, the same halo trick `legibleText` in theme.ts uses for text:
// whichever one actually contrasts with that screen's background is the one
// that reads, so the whole thing stays visible over both the light and
// dark/photo screens in the app without needing to know which screen it's
// on. Mounted once at the root layout, above everything else and
// pointerEvents="none", so it never competes with real content or steals a
// touch.
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const LAP_DURATION_MS = 105000; // slow, ambient drift
const PULSE_LEG_MS = 2600; // one brighten or dim half-cycle of the "breathing" glow
const DOT_COUNT = 3;
const HEAD_LENGTH = 16; // the comet's bright head
const TAIL_LENGTH = 22; // the fading streak trailing behind it
const TAIL_LAG = 18; // how far behind the head the tail sits, along the path
const STROKE_WIDTH = 1.5;
const GLOW_STROKE_WIDTH = 7;
const BLOOM_STROKE_WIDTH = 15;
const LIGHT_COLOR = "#FFF6E6"; // light, airy near-white rather than a solid gold
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

  // Three comets, evenly spaced: each dasharray pattern (one mark plus a
  // gap) repeats exactly DOT_COUNT times around the perimeter, which SVG
  // does automatically for a dasharray shorter than the path. The tail uses
  // the same spacing but its own, longer mark, and sits a little further
  // back along the path than the head via a separate, lagging dashoffset.
  const spacing = perimeter / DOT_COUNT;
  const headDashArray = `${HEAD_LENGTH} ${Math.max(0, spacing - HEAD_LENGTH)}`;
  const tailDashArray = `${TAIL_LENGTH} ${Math.max(0, spacing - TAIL_LENGTH)}`;

  const headOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -perimeter],
  });
  const tailOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [TAIL_LAG, -perimeter + TAIL_LAG],
  });

  const bloomOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.38] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.65] });
  const headOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
  const tailOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.45] });
  const shadowBloomOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.22] });
  const shadowGlowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.4] });
  const shadowHeadOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.7] });
  const shadowTailOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.28] });

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* The slim edge line itself — light and dark rims stacked, so one of
          them always shows against whatever that screen's background is. */}
      <Rect x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none" stroke={DARK_COLOR} strokeWidth={1} strokeOpacity={0.12} />
      <Rect x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none" stroke={LIGHT_COLOR} strokeWidth={1} strokeOpacity={0.14} />

      {/* Dark shadow passes beneath the light ones, same dash patterns, so
          the comets read on a light/pale screen too, not just a dark one. */}
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={DARK_COLOR} strokeWidth={STROKE_WIDTH} strokeOpacity={shadowTailOpacity}
        strokeLinecap="round" strokeDasharray={tailDashArray} strokeDashoffset={tailOffset}
      />
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={DARK_COLOR} strokeWidth={BLOOM_STROKE_WIDTH} strokeOpacity={shadowBloomOpacity}
        strokeLinecap="round" strokeDasharray={headDashArray} strokeDashoffset={headOffset}
      />
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={DARK_COLOR} strokeWidth={GLOW_STROKE_WIDTH} strokeOpacity={shadowGlowOpacity}
        strokeLinecap="round" strokeDasharray={headDashArray} strokeDashoffset={headOffset}
      />
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={DARK_COLOR} strokeWidth={STROKE_WIDTH} strokeOpacity={shadowHeadOpacity}
        strokeLinecap="round" strokeDasharray={headDashArray} strokeDashoffset={headOffset}
      />

      {/* The light tail, bloom, glow and head — brighter and warmer, reads
          on its own against a dark or photographic screen. */}
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={LIGHT_COLOR} strokeWidth={STROKE_WIDTH} strokeOpacity={tailOpacity}
        strokeLinecap="round" strokeDasharray={tailDashArray} strokeDashoffset={tailOffset}
      />
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={LIGHT_COLOR} strokeWidth={BLOOM_STROKE_WIDTH} strokeOpacity={bloomOpacity}
        strokeLinecap="round" strokeDasharray={headDashArray} strokeDashoffset={headOffset}
      />
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={LIGHT_COLOR} strokeWidth={GLOW_STROKE_WIDTH} strokeOpacity={glowOpacity}
        strokeLinecap="round" strokeDasharray={headDashArray} strokeDashoffset={headOffset}
      />
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={LIGHT_COLOR} strokeWidth={STROKE_WIDTH} strokeOpacity={headOpacity}
        strokeLinecap="round" strokeDasharray={headDashArray} strokeDashoffset={headOffset}
      />
    </Svg>
  );
}
