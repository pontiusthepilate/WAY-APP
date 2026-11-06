import React, { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, type ColorValue } from "react-native";
import { colors, typography } from "../theme/theme";

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
export interface FloatingTabBarProps {
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
    const yDuration = 2200 + seed * 260;
    const xDuration = 2800 + seed * 340;
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
  // A faint tilt tied to the vertical bob — like a buoy leaning as it rises
  // and falls, not just sliding straight up and down.
  const rotate = y.interpolate({ inputRange: [0, 1], outputRange: ["-3deg", "3deg"] });

  return { transform: [{ translateY }, { translateX }, { rotate }] };
}

export function FloatingTabBar({ state, descriptors, navigation, insets }: FloatingTabBarProps) {
  const bottomPadding = Math.max(insets.bottom, 10);
  return (
    <View style={[styles.bar, { paddingBottom: bottomPadding, height: 62 + bottomPadding }]} pointerEvents="box-none">
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
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    backgroundColor: "transparent",
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "flex-start" },
  tabContent: { alignItems: "center", gap: 2 },
  label: { ...typography.caption, fontWeight: "600" },
});
