import React, { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { colors, radii } from "../theme/theme";

// A single point of light traces the entire edge of the screen in a slow,
// endless lap, pulsing brighter and dimmer as it travels — plus a slim
// static outline so the edge always reads faintly even between passes.
// Its color alternates between white and the WAY brand teal once a day (by
// calendar day, not by lap), so every app open on the same day shows the
// same color. Mounted once at the root layout, pointerEvents="none".
const PALETTE = [colors.primary, "#FFFFFF"];

const DAY_MS = 24 * 60 * 60 * 1000;
const LAP_DURATION_MS = 90000; // slow, ambient drift
const PULSE_LEG_MS = 2600; // one brighten or dim half-cycle of the "breathing" glow
const DOT_LENGTH = 1; // with round caps this draws as a small circle, not a dash
const STROKE_WIDTH = 1.5;
const GLOW_STROKE_WIDTH = 7;
const BLOOM_STROKE_WIDTH = 15;
const DARK_COLOR = colors.primaryDark;
const LIGHT_COLOR = "#FFF6E6";

function colorForToday(): string {
  const dayIndex = Math.floor(Date.now() / DAY_MS);
  return PALETTE[dayIndex % PALETTE.length];
}

function msUntilNextDay(): number {
  return DAY_MS - (Date.now() % DAY_MS) + 1000;
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export function OrbitDot() {
  const { width, height } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const [color, setColor] = useState(colorForToday);

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

  // Re-checks at the next local-midnight boundary, and again every 24h after
  // that, so a session left open overnight still rotates color on time
  // instead of only picking up the new one on the next cold start.
  useEffect(() => {
    const timer = setTimeout(() => setColor(colorForToday()), msUntilNextDay());
    return () => clearTimeout(timer);
  }, [color]);

  const inset = BLOOM_STROKE_WIDTH / 2;
  const rectWidth = Math.max(0, width - BLOOM_STROKE_WIDTH);
  const rectHeight = Math.max(0, height - BLOOM_STROKE_WIDTH);
  const perimeter = 2 * (rectWidth + rectHeight);
  const dashArray = `${DOT_LENGTH} ${Math.max(0, perimeter - DOT_LENGTH)}`;
  const strokeDashoffset = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -perimeter] });

  const bloomOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.32] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.26, 0.6] });
  const coreOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });
  const shadowBloomOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.18] });
  const shadowGlowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.32] });
  const shadowCoreOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.6] });

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* The slim edge line itself — light and dark rims stacked, so one of
          them always shows against whatever that screen's background is. */}
      <Rect x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none" stroke={DARK_COLOR} strokeWidth={1} strokeOpacity={0.12} />
      <Rect x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none" stroke={LIGHT_COLOR} strokeWidth={1} strokeOpacity={0.14} />

      {/* Dark shadow pass beneath the colored one, same dash pattern, so
          the dot reads on a light/pale screen too, not just a dark one. */}
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

      {/* Today's color from the 10-color palette. */}
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={color} strokeWidth={BLOOM_STROKE_WIDTH} strokeOpacity={bloomOpacity}
        strokeLinecap="round" strokeDasharray={dashArray} strokeDashoffset={strokeDashoffset}
      />
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={color} strokeWidth={GLOW_STROKE_WIDTH} strokeOpacity={glowOpacity}
        strokeLinecap="round" strokeDasharray={dashArray} strokeDashoffset={strokeDashoffset}
      />
      <AnimatedRect
        x={inset} y={inset} width={rectWidth} height={rectHeight} rx={radii.lg} fill="none"
        stroke={color} strokeWidth={STROKE_WIDTH} strokeOpacity={coreOpacity}
        strokeLinecap="round" strokeDasharray={dashArray} strokeDashoffset={strokeDashoffset}
      />
    </Svg>
  );
}
