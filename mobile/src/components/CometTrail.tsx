import React, { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Defs, LinearGradient, Path, Polygon, Stop } from "react-native-svg";

// A rare meteor matching a real shooting-star photo reference: a sharp
// white sparkle (a 4-point star flare, not just a soft round glow) with
// one long, continuous, tapering white trail fading to transparent. Two
// earlier drafts missed the mark — a plain round glow read as "a bigger
// dot", and a warm-ember/rock palette read as a meteor, not a shooting
// star — this version is cool white/silver throughout, like the photo. It
// tears in from off-screen and detonates at a random point anywhere on
// screen — not at the edge — in a brief spark burst. Deliberately rare
// (roughly once an hour, with jitter) so it reads as a surprise rather
// than ambient wallpaper motion; the constantly-on edge decoration is
// OrbitDot, a separate component. Mounted once at the root layout,
// pointerEvents="none", so it's purely ambient and never competes with a
// real touch.
const CORE_COLOR = "#FFFFFF"; // white-hot center
const GLOW_COLOR = "#F4F7FF"; // cool near-white halo
const TRAIL_COLOR = "#FFFFFF"; // white trail, fading to transparent at the tail
const BURST_COLOR = "#FFFFFF";

const TRAVEL_MS = 1300; // fast, dramatic tear across the screen
const PAUSE_MS = 60 * 60 * 1000; // ~1 hour between appearances — rare, by design
const PAUSE_JITTER_MS = 15 * 60 * 1000;
const HEAD_SIZE = 20; // small, bright point — the trail is what reads as long
const SPARKLE_SIZE = HEAD_SIZE * 1.6; // the 4-point flare extends past the soft glow
const TRAIL_LENGTH = 190; // px, clamped down for a short travel distance
const TRAIL_HEAD_WIDTH = 7; // px, tapers to a point at the tail
const BURST_PARTICLES = 8;
const BURST_RADIUS = 58;

// A classic lens-flare "twinkle": two thin kite shapes crossing at the
// center, tapering to a point at each of the 4 tips — the same sparkle a
// bright point of light gets in a real night-sky photo, not achievable
// with a plain circle.
function Sparkle({ size, color }: { size: number; color: string }) {
  const c = size / 2;
  const thin = size * 0.07;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Path d={`M${c},0 L${c + thin},${c} L${c},${size} L${c - thin},${c} Z`} fill={color} />
      <Path d={`M0,${c} L${c},${c - thin} L${size},${c} L${c},${c + thin} Z`} fill={color} />
    </Svg>
  );
}

type Point = { x: number; y: number };
type Lap = {
  start: Point;
  end: Point;
  angle: number;
  trailLength: number;
  // Shared spike angles/radius-ratios for the head's glow — a different
  // random jagged silhouette each lap, not a perfect circle. The bloom/
  // glow/core layers reuse the same ratios at 3 scales so they read as
  // one light source with soft falloff, not 3 unrelated shapes.
  spikeAngles: number[];
  spikeRadii: number[];
};

const EDGES = ["top", "right", "bottom", "left"] as const;
const SPIKE_COUNT_MIN = 7;
const SPIKE_COUNT_RANGE = 3;

function randomSpikes(): { angles: number[]; radii: number[] } {
  const count = SPIKE_COUNT_MIN + Math.floor(Math.random() * SPIKE_COUNT_RANGE);
  const angles: number[] = [];
  const radii: number[] = [];
  for (let i = 0; i < count; i++) {
    angles.push((i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4);
    radii.push(0.5 + Math.random() * 0.5);
  }
  return { angles, radii };
}

// All 3 nested layers share one center point (the canvas center) and the
// same spike angles/ratios — only maxRadius differs — so they stay
// concentric instead of each shape centering on its own, smaller box.
function spikePoints(center: number, maxRadius: number, angles: number[], radii: number[]): string {
  return angles
    .map((a, i) => `${(center + Math.cos(a) * maxRadius * radii[i]).toFixed(1)},${(center + Math.sin(a) * maxRadius * radii[i]).toFixed(1)}`)
    .join(" ");
}

function randomLap(width: number, height: number): Lap {
  // Enters from just outside one random edge...
  const edge = EDGES[Math.floor(Math.random() * 4)];
  function pointOnEdge(e: (typeof EDGES)[number]): Point {
    const margin = 40;
    if (e === "top") return { x: margin + Math.random() * (width - margin * 2), y: -HEAD_SIZE };
    if (e === "bottom") return { x: margin + Math.random() * (width - margin * 2), y: height + HEAD_SIZE };
    if (e === "left") return { x: -HEAD_SIZE, y: margin + Math.random() * (height - margin * 2) };
    return { x: width + HEAD_SIZE, y: margin + Math.random() * (height - margin * 2) };
  }
  const start = pointOnEdge(edge);

  // ...and detonates somewhere on the screen — anywhere, not confined to a
  // safe interior box — rather than fading out past an edge. The margin
  // here is just enough that the spark burst itself doesn't get clipped.
  const edgeMargin = BURST_RADIUS * 0.5;
  const end = {
    x: edgeMargin + Math.random() * (width - edgeMargin * 2),
    y: edgeMargin + Math.random() * (height - edgeMargin * 2),
  };

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const angle = Math.atan2(dy, dx);
  // Never let the trail overshoot past the start point on a short hop.
  const trailLength = Math.min(TRAIL_LENGTH, distance * 0.85);

  const { angles: spikeAngles, radii: spikeRadii } = randomSpikes();

  return { start, end, angle, trailLength, spikeAngles, spikeRadii };
}

export function CometTrail() {
  const { width, height } = useWindowDimensions();
  const [t] = useState(() => new Animated.Value(0));
  const [burst] = useState(() => new Animated.Value(0));
  // Seeded with a real spike shape (not empty arrays) so the very first
  // render — before any lap has actually run — never hands Polygon an
  // empty points="" string, which react-native-svg doesn't handle cleanly.
  const [lap, setLap] = useState<Lap>(() => {
    const { angles, radii } = randomSpikes();
    return { start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, angle: 0, trailLength: 0, spikeAngles: angles, spikeRadii: radii };
  });

  useEffect(() => {
    if (width === 0 || height === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    function run() {
      if (cancelled) return;
      setLap(randomLap(width, height));
      t.setValue(0);
      burst.setValue(0);
      Animated.timing(t, { toValue: 1, duration: TRAVEL_MS, easing: Easing.linear, useNativeDriver: true }).start(() => {
        if (cancelled) return;
        Animated.timing(burst, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        timer = setTimeout(run, PAUSE_MS + Math.random() * PAUSE_JITTER_MS);
      });
    }

    timer = setTimeout(run, 5000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [t, burst, width, height]);

  const headX = t.interpolate({ inputRange: [0, 1], outputRange: [lap.start.x, lap.end.x] });
  const headY = t.interpolate({ inputRange: [0, 1], outputRange: [lap.start.y, lap.end.y] });
  const headOpacity = t.interpolate({ inputRange: [0, 0.08, 0.96, 1], outputRange: [0, 1, 1, 0] });

  const burstScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const burstOpacity = burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] });

  // The trail is a tapering wedge (full width at the head, a point at the
  // tail) drawn once per lap in its own small local canvas, then translated
  // around the screen together with the head using the same x/y values —
  // so it's a fixed-length streak that follows the bright point, not a
  // string of separate trailing dots.
  const canvas = Math.max(1, lap.trailLength * 2);
  const dirX = Math.cos(lap.angle);
  const dirY = Math.sin(lap.angle);
  const perpX = -dirY;
  const perpY = dirX;
  const headLocal = { x: lap.trailLength, y: lap.trailLength };
  const tailLocal = { x: headLocal.x - dirX * lap.trailLength, y: headLocal.y - dirY * lap.trailLength };
  const halfWidth = TRAIL_HEAD_WIDTH / 2;
  const wedgePoints = [
    `${headLocal.x + perpX * halfWidth},${headLocal.y + perpY * halfWidth}`,
    `${headLocal.x - perpX * halfWidth},${headLocal.y - perpY * halfWidth}`,
    `${tailLocal.x},${tailLocal.y}`,
  ].join(" ");

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Trail: one continuous tapering streak, not discrete beads. */}
      <Animated.View
        style={{
          position: "absolute",
          width: canvas,
          height: canvas,
          left: -lap.trailLength,
          top: -lap.trailLength,
          opacity: headOpacity,
          transform: [{ translateX: headX }, { translateY: headY }],
        }}
      >
        <Svg width={canvas} height={canvas} viewBox={`0 0 ${canvas} ${canvas}`}>
          <Defs>
            <LinearGradient
              id="trail"
              gradientUnits="userSpaceOnUse"
              x1={headLocal.x}
              y1={headLocal.y}
              x2={tailLocal.x}
              y2={tailLocal.y}
            >
              <Stop offset="0" stopColor={TRAIL_COLOR} stopOpacity={0.85} />
              <Stop offset="0.4" stopColor={TRAIL_COLOR} stopOpacity={0.45} />
              <Stop offset="1" stopColor={TRAIL_COLOR} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Polygon points={wedgePoints} fill="url(#trail)" />
        </Svg>
      </Animated.View>

      {/* Head: a jagged, randomly-pointed glow (never a perfect circle) at
          3 nested scales — bloom/glow/core share the same random spike
          silhouette so they read as one light source with soft falloff —
          behind a sharp 4-point sparkle flare. The sparkle plus the
          irregular glow is what makes it read as a real twinkling star
          rather than a plain glowing dot. */}
      <Animated.View style={[styles.headGlowWrap, { opacity: headOpacity, transform: [{ translateX: headX }, { translateY: headY }] }]}>
        <Svg width={HEAD_SIZE} height={HEAD_SIZE} viewBox={`0 0 ${HEAD_SIZE} ${HEAD_SIZE}`}>
          <Polygon points={spikePoints(HEAD_SIZE / 2, HEAD_SIZE / 2, lap.spikeAngles, lap.spikeRadii)} fill={GLOW_COLOR} opacity={0.35} />
          <Polygon points={spikePoints(HEAD_SIZE / 2, (HEAD_SIZE * 0.6) / 2, lap.spikeAngles, lap.spikeRadii)} fill={GLOW_COLOR} opacity={0.7} />
          <Polygon points={spikePoints(HEAD_SIZE / 2, (HEAD_SIZE * 0.32) / 2, lap.spikeAngles, lap.spikeRadii)} fill={CORE_COLOR} opacity={1} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.headSparkle, { opacity: headOpacity, transform: [{ translateX: headX }, { translateY: headY }] }]}>
        <Sparkle size={SPARKLE_SIZE} color={CORE_COLOR} />
      </Animated.View>

      {/* Burst: sparks radiate outward from where the star detonates,
          mid-screen — the whole point of exploding ON the screen vs.
          fading out at the edge. */}
      {Array.from({ length: BURST_PARTICLES }).map((_, i) => {
        const angle = (i / BURST_PARTICLES) * Math.PI * 2 + i * 0.31;
        const dx = burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * BURST_RADIUS] });
        const dy = burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * BURST_RADIUS] });
        return (
          <Animated.View
            key={i}
            style={[
              styles.burstParticle,
              {
                left: lap.end.x - 3,
                top: lap.end.y - 3,
                opacity: burstOpacity,
                transform: [{ translateX: dx }, { translateY: dy }, { scale: burstScale }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  headGlowWrap: {
    position: "absolute",
    width: HEAD_SIZE,
    height: HEAD_SIZE,
    left: -HEAD_SIZE / 2,
    top: -HEAD_SIZE / 2,
  },
  headSparkle: {
    position: "absolute",
    width: SPARKLE_SIZE,
    height: SPARKLE_SIZE,
    left: -SPARKLE_SIZE / 2,
    top: -SPARKLE_SIZE / 2,
  },
  burstParticle: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BURST_COLOR,
  },
});
