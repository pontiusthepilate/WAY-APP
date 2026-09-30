import React, { useEffect, useState } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { colors, radii, typography } from "../theme/theme";
import type { NearbyResult } from "../types";

const RING_COUNT = 4;

interface Props {
  results: NearbyResult[];
  radiusMeters: number;
  size: number;
  onSelect: (result: NearbyResult) => void;
}

export function RadarView({ results, radiusMeters, size, onSelect }: Props) {
  const center = size / 2;
  const maxScreenRadius = center - 28; // leave room for avatar bubbles at the edge
  const [sweepAngle] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweepAngle, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [sweepAngle]);

  const spin = sweepAngle.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {Array.from({ length: RING_COUNT }).map((_, i) => (
          <Circle
            key={i}
            cx={center}
            cy={center}
            r={(maxScreenRadius / RING_COUNT) * (i + 1)}
            stroke={colors.radarRing}
            strokeWidth={1}
            fill="none"
          />
        ))}
        <Line x1={center} y1={center - maxScreenRadius} x2={center} y2={center + maxScreenRadius} stroke={colors.radarRing} strokeWidth={1} />
        <Line x1={center - maxScreenRadius} y1={center} x2={center + maxScreenRadius} y2={center} stroke={colors.radarRing} strokeWidth={1} />
      </Svg>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.sweep,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ rotate: spin }],
          },
        ]}
      />

      <View style={[styles.centerDot, { left: center - 7, top: center - 7 }]} />

      {results.map((r) => {
        const clampedDistance = Math.min(r.distanceMeters, radiusMeters);
        const screenRadius = (clampedDistance / radiusMeters) * maxScreenRadius;
        const angleRad = (r.bearingDegrees * Math.PI) / 180;
        const x = center + screenRadius * Math.sin(angleRad);
        const y = center - screenRadius * Math.cos(angleRad);

        return (
          <Pressable
            key={r.id}
            onPress={() => onSelect(r)}
            style={[styles.avatarWrap, { left: x - 20, top: y - 20 }]}
          >
            {r.displayPictureUrl ? (
              <Image source={{ uri: r.displayPictureUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{r.displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </Pressable>
        );
      })}

      <Text style={styles.youLabel}>You</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sweep: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "transparent",
    borderTopColor: colors.radarSweep,
    borderTopWidth: 2,
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
  },
  centerDot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  youLabel: {
    position: "absolute",
    alignSelf: "center",
    top: "52%",
    ...typography.caption,
    color: colors.textSecondary,
  },
  avatarWrap: {
    position: "absolute",
    width: 40,
    height: 40,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.primaryLight,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: colors.primaryDark,
    fontWeight: "700",
  },
});
