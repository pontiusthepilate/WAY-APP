import React, { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { colors } from "../theme/theme";

// A single small, illuminated dot glides around the border of whatever it
// wraps — the same traveling-glow idea the screen-edge effect used before it
// became CometTrail, scaled down to a button's own size and run just once
// per instance, reserved for a screen's
// single most important action rather than every control, since each
// instance needs its own continuously-updating JS-driven animation (SVG
// strokeDashoffset/strokeOpacity aren't eligible for the native driver).
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const DOT_LENGTH = 1; // with round caps this draws as a small circle, not a dash
const STROKE_WIDTH = 1.5;
const GLOW_STROKE_WIDTH = 5;

export type DotOutlineTone = "onDark" | "onLight";

const COLOR: Record<DotOutlineTone, string> = {
  onDark: "#FFF6E6", // a light dot for a dark/filled button
  onLight: colors.primaryDark, // a dark dot for a light/gold button
};

interface Props {
  radius: number; // must match the wrapped element's own borderRadius
  tone: DotOutlineTone;
  // A full lap's duration — buttons are small, so this defaults much
  // quicker than the screen-edge border's 105s lap.
  lapDurationMs?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function DotOutline({ radius, tone, lapDurationMs = 5000, children, style }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: lapDurationMs,
        easing: Easing.linear,
        // strokeDashoffset isn't a transform/opacity View prop, so this
        // can't run on the native driver.
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress, lapDurationMs]);

  function handleLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }

  const inset = GLOW_STROKE_WIDTH / 2;
  const w = Math.max(0, size.width - GLOW_STROKE_WIDTH);
  const h = Math.max(0, size.height - GLOW_STROKE_WIDTH);
  const perimeter = 2 * (w + h);
  const dashArray = `${DOT_LENGTH} ${Math.max(0, perimeter - DOT_LENGTH)}`;
  const strokeDashoffset = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -perimeter] });
  const color = COLOR[tone];

  return (
    <View style={style} onLayout={handleLayout}>
      {children}
      {size.width > 0 && size.height > 0 && (
        <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <AnimatedRect
            x={inset} y={inset} width={w} height={h} rx={radius} fill="none"
            stroke={color} strokeWidth={GLOW_STROKE_WIDTH} strokeOpacity={0.35}
            strokeLinecap="round" strokeDasharray={dashArray} strokeDashoffset={strokeDashoffset}
          />
          <AnimatedRect
            x={inset} y={inset} width={w} height={h} rx={radius} fill="none"
            stroke={color} strokeWidth={STROKE_WIDTH} strokeOpacity={0.9}
            strokeLinecap="round" strokeDasharray={dashArray} strokeDashoffset={strokeDashoffset}
          />
        </Svg>
      )}
    </View>
  );
}
