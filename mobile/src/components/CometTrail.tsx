import React, { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Polygon } from "react-native-svg";

// A rare meteor: a small jagged rock (not a circle) with a glowing ember
// trail tears in from off-screen and detonates at a point well inside the
// screen — not at the edge — in a brief spark burst. Deliberately rare
// (roughly once an hour, with jitter) so it reads as a surprise rather than
// ambient wallpaper motion; the constantly-on edge decoration is OrbitDot,
// a separate component. Mounted once at the root layout, pointerEvents=
// "none", so it's purely ambient and never competes with a real touch.
const EMBER_BRIGHT = "#FFE3B3"; // hot near-white-gold core/highlight
const EMBER_MID = "#FF9D4D"; // orange glow
const ROCK_FILL = "#332A22"; // dark charcoal-brown rock body
const ROCK_RIM = "#FFB454"; // glowing heated rim around the rock's edge

const TRAVEL_MS = 1200; // fast, dramatic tear across the screen
const PAUSE_MS = 60 * 60 * 1000; // ~1 hour between appearances — rare, by design
const PAUSE_JITTER_MS = 15 * 60 * 1000;
const TRAIL_SEGMENTS = 6;
const ROCK_SIZE = 18; // small — a rock, not a blob
const ROCK_SPINS = 2.5; // full tumbles over one travel
const BURST_PARTICLES = 8;
const BURST_RADIUS = 58;

type Point = { x: number; y: number };
type Lap = { start: Point; end: Point; rockPoints: string };

const EDGES = ["top", "right", "bottom", "left"] as const;

function randomRockPoints(size: number): string {
  // An irregular polygon (not a regular one) so it reads as a tumbling
  // rock: 7-8 vertices at randomized radius/angle around the center.
  const center = size / 2;
  const vertexCount = 7 + Math.round(Math.random());
  const points: string[] = [];
  for (let i = 0; i < vertexCount; i++) {
    const angle = (i / vertexCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    const radius = center * (0.55 + Math.random() * 0.45);
    points.push(`${(center + Math.cos(angle) * radius).toFixed(1)},${(center + Math.sin(angle) * radius).toFixed(1)}`);
  }
  return points.join(" ");
}

function randomLap(width: number, height: number): Lap {
  // Enters from just outside one random edge...
  const edge = EDGES[Math.floor(Math.random() * 4)];
  function pointOnEdge(e: (typeof EDGES)[number]): Point {
    const margin = 40;
    if (e === "top") return { x: margin + Math.random() * (width - margin * 2), y: -ROCK_SIZE };
    if (e === "bottom") return { x: margin + Math.random() * (width - margin * 2), y: height + ROCK_SIZE };
    if (e === "left") return { x: -ROCK_SIZE, y: margin + Math.random() * (height - margin * 2) };
    return { x: width + ROCK_SIZE, y: margin + Math.random() * (height - margin * 2) };
  }
  // ...and detonates somewhere on the screen — anywhere, not confined to a
  // safe interior box — rather than fading out past an edge. The margin
  // here is just enough that the spark burst itself doesn't get clipped.
  const edgeMargin = BURST_RADIUS * 0.5;
  const end = {
    x: edgeMargin + Math.random() * (width - edgeMargin * 2),
    y: edgeMargin + Math.random() * (height - edgeMargin * 2),
  };

  return { start: pointOnEdge(edge), end, rockPoints: randomRockPoints(ROCK_SIZE) };
}

export function CometTrail() {
  const { width, height } = useWindowDimensions();
  const [t] = useState(() => new Animated.Value(0));
  const [burst] = useState(() => new Animated.Value(0));
  const [lap, setLap] = useState<Lap>({ start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, rockPoints: "" });

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
  const headOpacity = t.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 1, 1, 0] });
  const headRotate = t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${360 * ROCK_SPINS}deg`] });

  const burstScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const burstOpacity = burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Tail: segments lag behind the head by an increasing fraction of the
          lap, shrinking and dimming further back, so it reads as a trailing
          ember streak rather than a string of identical beads. */}
      {Array.from({ length: TRAIL_SEGMENTS }).map((_, i) => {
        const laggedT = 0.04 * (i + 1);
        const segT = t.interpolate({ inputRange: [0, laggedT, 1], outputRange: [0, 0, 1 - laggedT], extrapolate: "clamp" });
        const x = segT.interpolate({ inputRange: [0, 1], outputRange: [lap.start.x, lap.end.x] });
        const y = segT.interpolate({ inputRange: [0, 1], outputRange: [lap.start.y, lap.end.y] });
        const baseOpacity = 0.55 - i * 0.08;
        const opacity = t.interpolate({
          inputRange: [0, laggedT, laggedT + 0.01, 0.9, 1],
          outputRange: [0, 0, baseOpacity, baseOpacity, 0],
          extrapolate: "clamp",
        });
        const size = Math.max(2, ROCK_SIZE * 0.5 - i * 2);
        return (
          <Animated.View
            key={i}
            style={[
              styles.trailSegment,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                left: -size / 2,
                top: -size / 2,
                opacity,
                backgroundColor: i === 0 ? EMBER_BRIGHT : EMBER_MID,
                transform: [{ translateX: x }, { translateY: y }],
              },
            ]}
          />
        );
      })}

      {/* Head: a soft ember glow behind a small jagged rock, tumbling as it
          travels (round shapes read as "dot", a rock reads as a meteor). */}
      <Animated.View style={[styles.headHalo, { opacity: headOpacity, transform: [{ translateX: headX }, { translateY: headY }] }]} />
      <Animated.View
        style={[styles.headRock, { opacity: headOpacity, transform: [{ translateX: headX }, { translateY: headY }, { rotate: headRotate }] }]}
      >
        <Svg width={ROCK_SIZE} height={ROCK_SIZE} viewBox={`0 0 ${ROCK_SIZE} ${ROCK_SIZE}`}>
          <Polygon points={lap.rockPoints} fill={ROCK_FILL} stroke={ROCK_RIM} strokeWidth={1.2} strokeLinejoin="round" />
        </Svg>
      </Animated.View>

      {/* Burst: sparks radiate outward from where the rock detonates, mid-
          screen — the whole point of the redesign vs. fading out at the
          edge. */}
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
  headHalo: {
    position: "absolute",
    width: ROCK_SIZE * 1.6,
    height: ROCK_SIZE * 1.6,
    left: -(ROCK_SIZE * 1.6) / 2,
    top: -(ROCK_SIZE * 1.6) / 2,
    borderRadius: (ROCK_SIZE * 1.6) / 2,
    backgroundColor: EMBER_MID,
    opacity: 0.3,
  },
  headRock: {
    position: "absolute",
    width: ROCK_SIZE,
    height: ROCK_SIZE,
    left: -ROCK_SIZE / 2,
    top: -ROCK_SIZE / 2,
  },
  trailSegment: {
    position: "absolute",
  },
  burstParticle: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: EMBER_BRIGHT,
  },
});
