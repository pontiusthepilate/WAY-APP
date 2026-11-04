import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../theme/theme";

// A soft ring of color expands outward from whatever it wraps and fades out
// as it grows, then resets — the "location ping" effect ride-hailing apps
// use on their pickup pin. Measures its children once via onLayout so the
// ring starts exactly their size and stays centered on them; the children
// render on top, unaffected by the animation.
const PULSE_DURATION_MS = 1500;
const MAX_SCALE = 6; // ring grows to this many times the wrapped element's size before fading out

interface Props {
  color?: string;
  // Diameter in px the ring should grow to before fading out. Overrides
  // MAX_SCALE — use this when the ring needs to reach a specific landmark
  // (e.g. a surrounding ring line) regardless of the wrapped element's size.
  maxDiameter?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function LocationPulse({ color = colors.primary, maxDiameter, children, style }: Props) {
  const [size, setSize] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: PULSE_DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  function handleLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    const next = Math.max(width, height);
    setSize((prev) => (prev === next ? prev : next));
  }

  const maxScale = maxDiameter && size > 0 ? maxDiameter / size : MAX_SCALE;
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, maxScale] });
  // `progress` itself runs on an ease-out curve (set below), so it reaches
  // most of its range early — fading opacity out by 60% of *progress* meant
  // the ring was nearly invisible well before its scale caught up to
  // maxDiameter. Keeping opacity up until 85% of progress, then dropping
  // fast, keeps the ring visible for the stretch where it's actually
  // reaching its target size.
  const opacity = progress.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0.45, 0.22, 0] });

  return (
    <View style={style} onLayout={handleLayout}>
      {size > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              opacity,
              transform: [{ scale }],
            },
          ]}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
