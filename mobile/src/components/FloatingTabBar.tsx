import React, { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions, type ColorValue } from "react-native";
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
  insets: { top: number; bottom: number };
}

const ICON_BOX = 72;
const EDGE_MARGIN = 10;
const TOP_MARGIN = 12;
const BOTTOM_MARGIN = 12;
const LEG_MIN_MS = 7000;
const LEG_RANGE_MS = 5000;

interface Zone {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

// Each of the 5 icons wanders freely over the ENTIRE screen width but is
// confined to its own horizontal band top-to-bottom (band 0 = top fifth for
// the first tab, band 4 = bottom fifth for the last) — collectively they
// cover the whole screen the way a fixed bottom bar never could, while the
// banding guarantees two icons can never collide or stack on each other.
// Within its band an icon picks a new random point, eases to it over a few
// seconds, then picks another — an open-ended wander, not a repeating loop.
function useRandomWander(zone: Zone, seed: number) {
  const [pos] = useState(() => new Animated.ValueXY({ x: (zone.xMin + zone.xMax) / 2, y: (zone.yMin + zone.yMax) / 2 }));

  useEffect(() => {
    let cancelled = false;
    let startTimer: ReturnType<typeof setTimeout>;

    function wanderOnce() {
      if (cancelled) return;
      const targetX = zone.xMin + Math.random() * Math.max(0, zone.xMax - zone.xMin);
      const targetY = zone.yMin + Math.random() * Math.max(0, zone.yMax - zone.yMin);
      const duration = LEG_MIN_MS + Math.random() * LEG_RANGE_MS;
      Animated.timing(pos, {
        toValue: { x: targetX, y: targetY },
        duration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled) wanderOnce();
      });
    }

    // Staggered starts so five icons don't all change direction in lockstep.
    startTimer = setTimeout(wanderOnce, seed * 350);
    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      pos.stopAnimation();
    };
    // zone is a freshly computed object every render (derived from window
    // size), so it's intentionally excluded — only its values matter, and
    // those only change on rotation/resize, not worth restarting wander for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  return pos;
}

export function FloatingTabBar({ state, descriptors, navigation, insets }: FloatingTabBarProps) {
  const { width, height } = useWindowDimensions();
  const topInset = insets.top + TOP_MARGIN;
  const bottomInset = Math.max(insets.bottom, 10) + BOTTOM_MARGIN;
  const usableHeight = Math.max(0, height - topInset - bottomInset - ICON_BOX);
  const bandHeight = usableHeight / state.routes.length;
  const xMin = EDGE_MARGIN;
  const xMax = Math.max(xMin, width - ICON_BOX - EDGE_MARGIN);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const color = isFocused
          ? options.tabBarActiveTintColor ?? colors.primaryDark
          : options.tabBarInactiveTintColor ?? colors.textSecondary;
        const label = options.title ?? route.name;
        const yMin = topInset + index * bandHeight;
        const zone: Zone = { xMin, xMax, yMin, yMax: yMin + bandHeight };

        function onPress() {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }

        return (
          <FloatingTab key={route.key} onPress={onPress} seed={index} zone={zone}>
            {options.tabBarIcon?.({ focused: isFocused, color: color as string, size: 24 })}
            <Text style={[styles.label, { color }]}>{label}</Text>
          </FloatingTab>
        );
      })}
    </View>
  );
}

function FloatingTab({
  onPress,
  seed,
  zone,
  children,
}: {
  onPress: () => void;
  seed: number;
  zone: Zone;
  children: React.ReactNode;
}) {
  const pos = useRandomWander(zone, seed);
  return (
    <Animated.View style={[styles.tab, { transform: pos.getTranslateTransform() }]}>
      {/* A moving target needs a far more forgiving tap zone than a static
          button ever would — hitSlop is generous on purpose. */}
      <Pressable style={styles.tabPressable} onPress={onPress} hitSlop={28}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Covers the full screen now, not just a bottom strip — each icon is
  // positioned absolutely within it via its own animated transform.
  overlay: StyleSheet.absoluteFill,
  tab: { position: "absolute", left: 0, top: 0, width: ICON_BOX },
  tabPressable: { alignItems: "center", gap: 2 },
  label: { ...typography.caption, fontWeight: "600" },
});
