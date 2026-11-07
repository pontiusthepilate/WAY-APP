import React, { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, type ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../theme/theme";

// Deliberately not importing expo-router's BottomTabBarProps — its real
// export path moves around between Expo SDKs and isn't worth chasing down
// just for a type. This narrow shape is structurally compatible with
// whatever the real props object is (TS checks shape, not origin), and it's
// the only slice of it this component actually reads.
interface TabBarRoute {
  key: string;
  name: string;
}
interface TabBarDescriptor {
  options: {
    title?: string;
    tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
    tabBarActiveTintColor?: ColorValue;
    tabBarInactiveTintColor?: ColorValue;
  };
}
export interface CollapsibleTabBarProps {
  state: { index: number; routes: TabBarRoute[] };
  descriptors: Record<string, TabBarDescriptor>;
  navigation: {
    navigate: (name: string) => void;
    emit: (event: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
  };
  insets: { bottom: number };
}

// Each tab bobs and drifts on its own independent loop — different period
// and phase per icon (derived from its index) so five icons together read
// as separate buoys riding the same gentle swell, not one rigid shape
// moving in lockstep. Vertical bob and horizontal drift are driven by two
// separate Animated.Values per icon (different durations) so the combined
// path is a loose, organic wander rather than a straight up-down bounce.
function useBuoyantFloat(seed: number) {
  const [y] = useState(() => new Animated.Value(0));
  const [x] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const yDuration = (2200 + seed * 260) * 2;
    const xDuration = (2800 + seed * 340) * 2;
    const startDelay = seed * 180;

    const loopOf = (value: Animated.Value, duration: number, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );

    const yLoop = loopOf(y, yDuration, startDelay);
    const xLoop = loopOf(x, xDuration, startDelay + 120);
    yLoop.start();
    xLoop.start();
    return () => {
      yLoop.stop();
      xLoop.stop();
    };
  }, [x, y, seed]);

  const bobHeight = 4 + (seed % 3) * 1.5; // px
  const driftWidth = 3 + ((seed + 2) % 3) * 1.3; // px
  const translateY = y.interpolate({ inputRange: [0, 1], outputRange: [bobHeight, -bobHeight] });
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-driftWidth, driftWidth] });
  const rotate = y.interpolate({ inputRange: [0, 1], outputRange: ["-3deg", "3deg"] });

  return { transform: [{ translateY }, { translateX }, { rotate }] };
}

// The bottom nav, tucked away behind a small arrow instead of always being
// on screen. Tap the arrow to bring the 5 tabs up — the exact same bobbing
// row they used to float in permanently — tap it again (now pointing down)
// to collapse them back away. Auto-scroll's controls go back to their own
// shake-to-reveal WAY Button (see WayButton.tsx), fully independent of this.
export function CollapsibleTabBar({ state, descriptors, navigation, insets }: CollapsibleTabBarProps) {
  const [expanded, setExpanded] = useState(false);
  const bottomPadding = Math.max(insets.bottom, 10);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {expanded && (
        <View style={styles.row} pointerEvents="box-none">
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;
            const color = isFocused
              ? options.tabBarActiveTintColor ?? colors.primaryDark
              : options.tabBarInactiveTintColor ?? colors.textSecondary;
            const label = options.title ?? route.name;

            function onPress() {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }

            return (
              <FloatingTab key={route.key} onPress={onPress} seed={index}>
                {options.tabBarIcon?.({ focused: isFocused, color: color as string, size: 24 })}
                <Text style={[styles.label, { color }]}>{label}</Text>
              </FloatingTab>
            );
          })}
        </View>
      )}

      <Pressable
        style={[styles.arrowButton, { marginBottom: bottomPadding }]}
        onPress={() => setExpanded((v) => !v)}
        hitSlop={16}
        accessibilityLabel={expanded ? "Hide navigation" : "Show navigation"}
      >
        <Ionicons name={expanded ? "chevron-down" : "chevron-up"} size={28} color={colors.primaryDark} />
      </Pressable>
    </View>
  );
}

function FloatingTab({ onPress, seed, children }: { onPress: () => void; seed: number; children: React.ReactNode }) {
  const floatStyle = useBuoyantFloat(seed);
  return (
    <Pressable style={styles.tab} onPress={onPress} hitSlop={8}>
      <Animated.View style={[styles.tabContent, floatStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" },
  row: {
    flexDirection: "row",
    width: "100%",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "flex-start" },
  tabContent: { alignItems: "center", gap: 2 },
  label: { ...typography.caption, fontWeight: "600" },
  // Just the chevron glyph — no button shape behind it, per explicit
  // request. The shadow keeps it readable over busy/photo backgrounds
  // without needing a solid backing shape.
  arrowButton: {
    width: 44,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
});
