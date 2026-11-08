import React, { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, type ColorValue } from "react-native";
import Svg, { Circle, Polygon } from "react-native-svg";
import { colors, spacing, typography } from "../theme/theme";
import { OceanWavesBackground } from "./OceanWavesBackground";

// A genuine arrow: each leg is a constant-width quad (like a stroke would
// draw — two parallel edges the whole way down, NOT tapering to a point,
// which is what read as "a triangle" in an earlier attempt), except its
// OUTER top corner is stretched further out, along its own edge, until it
// touches the border line exactly; the inner top corner stays where a
// plain stroke would naturally put it. A small circle at the shared vertex
// covers the tiny gap the two legs' own offset corners would otherwise
// leave there (same thing strokeLinejoin="round" used to do for free).
const CHEVRON_WIDTH = 38;
const CHEVRON_HEIGHT = 22;
const CHEVRON_THICKNESS = 5.5;

function legPolygonPoints(topCenter: { x: number; y: number }, vertex: { x: number; y: number }, lineY: number): string {
  const dx = vertex.x - topCenter.x;
  const dy = vertex.y - topCenter.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const half = CHEVRON_THICKNESS / 2;
  const center = CHEVRON_WIDTH / 2;
  // Pick which perpendicular direction is "outer" (farther from the
  // chevron's own horizontal center) vs "inner" — same offset at both the
  // top and the vertex end keeps the two long edges parallel (constant
  // width), unlike tapering both edges to a single shared point.
  const outerSign = Math.abs(topCenter.x + nx * half - center) > Math.abs(topCenter.x - nx * half - center) ? 1 : -1;
  const outerTop = { x: topCenter.x + outerSign * nx * half, y: topCenter.y + outerSign * ny * half };
  const innerTop = { x: topCenter.x - outerSign * nx * half, y: topCenter.y - outerSign * ny * half };
  const outerBottom = { x: vertex.x + outerSign * nx * half, y: vertex.y + outerSign * ny * half };
  const innerBottom = { x: vertex.x - outerSign * nx * half, y: vertex.y - outerSign * ny * half };

  const edx = outerTop.x - vertex.x;
  const edy = outerTop.y - vertex.y;
  const t = (lineY - vertex.y) / edy;
  const outerExtended = { x: vertex.x + t * edx, y: vertex.y + t * edy };

  return `${outerExtended.x},${outerExtended.y} ${innerTop.x},${innerTop.y} ${innerBottom.x},${innerBottom.y} ${outerBottom.x},${outerBottom.y}`;
}

function BoldChevron({ direction, color }: { direction: "up" | "down"; color: string }) {
  const inset = CHEVRON_THICKNESS / 2 + 1;
  const leftX = inset;
  const rightX = CHEVRON_WIDTH - inset;
  const tipY = direction === "down" ? inset : CHEVRON_HEIGHT - inset;
  const vertexY = direction === "down" ? CHEVRON_HEIGHT - inset : inset;
  const vertex = { x: CHEVRON_WIDTH / 2, y: vertexY };

  return (
    <Svg width={CHEVRON_WIDTH} height={CHEVRON_HEIGHT} viewBox={`0 0 ${CHEVRON_WIDTH} ${CHEVRON_HEIGHT}`}>
      <Polygon points={legPolygonPoints({ x: leftX, y: tipY }, vertex, tipY)} fill={color} />
      <Polygon points={legPolygonPoints({ x: rightX, y: tipY }, vertex, tipY)} fill={color} />
      <Circle cx={vertex.x} cy={vertex.y} r={CHEVRON_THICKNESS / 2} fill={color} />
    </Svg>
  );
}

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

// Each tab bobs and drifts on its own independent loop around its own flex
// slot — different period and phase per icon (derived from its index) so
// five icons together read as separate buoys riding the same gentle swell,
// not one rigid shape moving in lockstep. Vertical bob and horizontal drift
// are driven by two separate Animated.Values per icon (different durations)
// so the combined path is a loose, organic wander rather than a straight
// up-down bounce.
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
// on screen. Collapsed, it's just the chevron floating over whatever the
// current screen shows — the full screen is visible, "entire phone screen"
// as normal. Tap it and a solid panel rises to hold the 5 tabs (the same
// bobbing row they used to float in permanently); its top border is where
// the visible screen now ends, with the chevron — flipped to point down —
// straddling that border, its two legs touching the line from above while
// its tip dips into the panel. Tap it again to collapse back to the plain
// floating arrow. Auto-scroll's controls stay on their own independent
// shake-to-reveal WAY Button (see WayButton.tsx).
export function CollapsibleTabBar({ state, descriptors, navigation, insets }: CollapsibleTabBarProps) {
  const [expanded, setExpanded] = useState(false);
  const bottomPadding = Math.max(insets.bottom, 10);

  const tabs = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const isFocused = state.index === index;
    // Ignores the passed-in tint colors (tuned for a light background) —
    // the panel is now a "deep" ocean-wave video wash, so labels need the
    // light-on-dark treatment instead, same as onboarding's own text.
    const color = isFocused ? colors.textOnPrimary : "rgba(255,255,255,0.68)";
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
  });

  if (expanded) {
    return (
      <View style={[styles.panel, { paddingBottom: bottomPadding }]} pointerEvents="box-none">
        {/* The exact clip onboarding's first 3 screens use, same "deep"
            wash — the panel reads as an extension of that same ocean. */}
        <OceanWavesBackground source={require("../../assets/onboarding-waves.mp4")} tone="deep" />
        <Pressable
          style={styles.arrowOnBorder}
          onPress={() => setExpanded(false)}
          hitSlop={16}
          accessibilityLabel="Hide navigation"
        >
          <BoldChevron direction="down" color={colors.textOnPrimary} />
        </Pressable>
        <View style={styles.row} pointerEvents="box-none">
          {tabs}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable
        style={[styles.arrowFloating, { marginBottom: bottomPadding }]}
        onPress={() => setExpanded(true)}
        hitSlop={16}
        accessibilityLabel="Show navigation"
      >
        <BoldChevron direction="up" color={colors.primary} />
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

const ARROW_SIZE = 40;

const styles = StyleSheet.create({
  container: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" },
  // Opaque on purpose (the video fill itself provides that) — collapsed,
  // the real screen content runs all the way to the bottom; expanded, this
  // panel is deliberately where the visible screen now "ends". A soft
  // shadow gives it lift/separation without a hard border line.
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -6 },
    elevation: 10,
  },
  row: {
    flexDirection: "row",
    width: "100%",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "flex-start" },
  tabContent: { alignItems: "center", gap: 2 },
  label: { ...typography.caption, fontWeight: "600" },
  // Just the chevron glyph — no button shape behind it. The shadow keeps it
  // readable over busy/photo backgrounds without needing a backing shape.
  arrowFloating: {
    width: ARROW_SIZE + 8,
    height: ARROW_SIZE,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: 14 }],
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  // Straddles the panel's own top border — negative top offset by half its
  // height pulls it up so the chevron's two legs sit right on the border
  // line (reading as touching it) while its downward tip dips just inside
  // the panel.
  arrowOnBorder: {
    position: "absolute",
    top: -(ARROW_SIZE / 2) + 12,
    left: "50%",
    marginLeft: -(ARROW_SIZE + 8) / 2,
    width: ARROW_SIZE + 8,
    height: ARROW_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
});
