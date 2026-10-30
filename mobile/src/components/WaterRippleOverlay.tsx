import React, { useCallback, useRef, useState } from "react";
import { Animated, Dimensions, StyleSheet, View, type GestureResponderEvent } from "react-native";
import { colors } from "../theme/theme";

// A touch anywhere in the app should feel like it's making contact with the
// sky/ocean backdrop itself — a brief ring that blooms outward from the
// fingertip, colored by how high or deep that touch landed: pale and airy
// near the top of the screen (piercing the sky), deepening to ocean teal
// toward the bottom (touching water). Mounted once at the root layout so
// every screen gets it for free; purely visual (pointerEvents="none" on the
// ripple layer) so it never steals a tap from the button underneath it.
interface Ripple {
  id: number;
  x: number;
  y: number;
  anim: Animated.Value;
  color: string;
}

const RIPPLE_SIZE = 120;
const RIPPLE_DURATION_MS = 650;

export function WaterRippleOverlay({ children }: { children: React.ReactNode }) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextId = useRef(0);

  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    const screenHeight = Dimensions.get("window").height;
    const depth = Math.min(1, Math.max(0, pageY / screenHeight));
    const color = depth < 0.4 ? colors.primaryLight : depth < 0.75 ? colors.horizon : colors.primaryDark;

    const anim = new Animated.Value(0);
    const id = nextId.current++;
    setRipples((prev) => [...prev, { id, x: pageX, y: pageY, anim, color }]);

    Animated.timing(anim, {
      toValue: 1,
      duration: RIPPLE_DURATION_MS,
      useNativeDriver: true,
    }).start(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    });
  }, []);

  return (
    <View
      style={styles.fill}
      // The plain `onTouchStart` DOM event never fires for a mouse click in
      // a non-touch browser (only real touches), so this uses RN's unified
      // responder system instead — the same system Pressable is built on,
      // which normalizes mouse/pointer/touch alike. Returning true only from
      // the non-capture `onStartShouldSetResponder` means any Pressable
      // deeper in the tree gets first refusal (it claims the responder for
      // itself before this ever gets asked), so buttons/scroll/etc. are
      // completely unaffected — this only answers for touches that land on
      // plain background.
      onStartShouldSetResponder={() => true}
      onResponderGrant={handleTouchStart}
    >
      {children}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {ripples.map((r) => (
          <RippleRing key={r.id} x={r.x} y={r.y} anim={r.anim} color={r.color} />
        ))}
      </View>
    </View>
  );
}

function RippleRing({ x, y, anim, color }: { x: number; y: number; anim: Animated.Value; color: string }) {
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] });
  const ringOpacity = anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] });
  const coreOpacity = anim.interpolate({ inputRange: [0, 0.1, 0.4], outputRange: [0.5, 0.3, 0] });

  return (
    <>
      <Animated.View
        style={[
          styles.core,
          { left: x - RIPPLE_SIZE / 4, top: y - RIPPLE_SIZE / 4, backgroundColor: color, opacity: coreOpacity },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          {
            left: x - RIPPLE_SIZE / 2,
            top: y - RIPPLE_SIZE / 2,
            borderColor: color,
            opacity: ringOpacity,
            transform: [{ scale }],
          },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  ring: {
    position: "absolute",
    width: RIPPLE_SIZE,
    height: RIPPLE_SIZE,
    borderRadius: RIPPLE_SIZE / 2,
    borderWidth: 1.5,
  },
  core: {
    position: "absolute",
    width: RIPPLE_SIZE / 2,
    height: RIPPLE_SIZE / 2,
    borderRadius: RIPPLE_SIZE / 4,
  },
});
