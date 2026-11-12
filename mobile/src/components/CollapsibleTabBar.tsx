import React, { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
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
// as normal. Tap it and a solid panel SLIDES UP from below the screen edge
// to hold the 5 tabs (the same bobbing row they used to float in
// permanently); its top border is where the visible screen now ends, with
// the chevron — flipped to point down — straddling that border, its two
// legs touching the line from above while its tip dips into the panel. Tap
// it again and the panel slides back down out of view before unmounting
// (kept mounted for the duration of that closing animation — see
// `mounted` below — otherwise it would just vanish mid-slide). Auto-
// scroll's controls stay on their own independent shake-to-reveal WAY
// Button (see WayButton.tsx).
const SLIDE_DURATION_OPEN = 600;
const SLIDE_DURATION_CLOSE = 540;
// A reasonable guess for the panel's height before it's ever been laid
// out once (needed so the very first open animation has somewhere to
// slide up FROM) — slightly tall is harmless since it's off-screen
// either way; onLayout below replaces it with the real measured height
// for every toggle after that.
const INITIAL_PANEL_HEIGHT_GUESS = 180;

export interface PanelTab {
  key: string;
  label: string;
  focused: boolean;
  icon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
  onPress: () => void;
}

// The floating arrow + slide-up panel itself, decoupled from React
// Navigation — also used directly (not through CollapsibleTabBar) by
// screens the Tabs navigator doesn't wrap, e.g. wallet-fund.tsx/go-live.tsx,
// which are pushed as plain stack screens and so never get a tab bar of
// their own. See lib/appTabs.ts for how those build their own `tabs` list.
export function FloatingNavPanel({ tabs, insets }: { tabs: PanelTab[]; insets: { bottom: number } }) {
  const [expanded, setExpanded] = useState(false);
  // Whether the panel is in the tree at all — stays true for the duration
  // of the closing slide so it has something to animate, then flips false
  // once that animation actually finishes.
  const [mounted, setMounted] = useState(false);
  const [slideAnim] = useState(() => new Animated.Value(0));
  const [panelHeight, setPanelHeight] = useState(INITIAL_PANEL_HEIGHT_GUESS);
  const bottomPadding = Math.max(insets.bottom, 10);

  function open() {
    setExpanded(true);
    setMounted(true);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: SLIDE_DURATION_OPEN,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function close() {
    setExpanded(false);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: SLIDE_DURATION_CLOSE,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }

  const tabNodes = tabs.map((tab, index) => {
    // Ignores the passed-in tint colors (tuned for a light background) —
    // the panel is now a "deep" ocean-wave video wash, so labels need the
    // light-on-dark treatment instead, same as onboarding's own text.
    const color = tab.focused ? colors.textOnPrimary : "rgba(255,255,255,0.68)";

    return (
      <FloatingTab key={tab.key} onPress={tab.onPress} seed={index}>
        {tab.icon?.({ focused: tab.focused, color, size: 24 })}
        <Text style={[styles.label, { color }]}>{tab.label}</Text>
      </FloatingTab>
    );
  });

  return (
    <View style={styles.container} pointerEvents="box-none">
      {!mounted && (
        <Pressable
          style={[styles.arrowFloating, { marginBottom: bottomPadding }]}
          onPress={open}
          hitSlop={16}
          accessibilityLabel="Show navigation"
        >
          <BoldChevron direction="up" color={colors.primary} />
        </Pressable>
      )}
      {mounted && (
        <Animated.View
          style={[
            styles.panel,
            { paddingBottom: bottomPadding },
            {
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [panelHeight, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents={expanded ? "box-none" : "none"}
          onLayout={(e) => {
            setPanelHeight(e.nativeEvent.layout.height);
          }}
        >
          {/* The exact clip onboarding's first 3 screens use, same "deep"
              wash — the panel reads as an extension of that same ocean. */}
          <OceanWavesBackground source={require("../../assets/onboarding-waves.mp4")} tone="deep" />
          {/* Less hitSlop on the bottom edge specifically — that's the side
              facing the tab row just below it, where a generous slop would
              make the arrow and the middle tab's own tap target overlap. */}
          <Pressable
            style={styles.arrowOnBorder}
            onPress={close}
            hitSlop={{ top: 16, left: 16, right: 16, bottom: 4 }}
            accessibilityLabel="Hide navigation"
          >
            <BoldChevron direction="down" color={colors.primary} />
          </Pressable>
          <View style={styles.row} pointerEvents="box-none">
            {tabNodes}
          </View>
        </Animated.View>
      )}
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
// Lands the down-chevron's own vertex (its visual "tip") exactly on the
// panel's top border instead of dipping into it — mirrors BoldChevron's
// own `inset` math (its vertex sits CHEVRON_HEIGHT - inset down from the
// glyph's own top) plus how far that glyph sits inside this centered
// ARROW_SIZE box, so the two stay in sync if either constant changes.
const CHEVRON_INSET = CHEVRON_THICKNESS / 2 + 1;
// A small extra nudge upward past "tip exactly on the border", requested
// on top of that base position — tune here.
const DOWN_ARROW_EXTRA_LIFT = 6;
const DOWN_ARROW_BOX_TOP = -((CHEVRON_HEIGHT - CHEVRON_INSET) + (ARROW_SIZE - CHEVRON_HEIGHT) / 2 + DOWN_ARROW_EXTRA_LIFT);

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
  // Straddles the panel's own top border — positioned so the chevron's
  // downward tip lands exactly on the border line rather than dipping
  // into the panel, which also keeps its (hitSlop-expanded) tap target
  // from reaching down into the tab row below it.
  arrowOnBorder: {
    position: "absolute",
    top: DOWN_ARROW_BOX_TOP,
    left: "50%",
    marginLeft: -(ARROW_SIZE + 8) / 2,
    width: ARROW_SIZE + 8,
    height: ARROW_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
});
