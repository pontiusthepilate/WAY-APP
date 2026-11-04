import React, { useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, legibleText, radii, spacing, typography } from "../theme/theme";
import { OceanWavesBackground } from "../components/OceanWavesBackground";
import { DotOutline } from "../components/DotOutline";
import { markOnboardingSeen } from "../lib/onboarding";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  headline: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: "radio-outline",
    headline: "Find people nearby",
    body: "See who's around you on the radar and connect in real time — no feed to scroll, just who's actually close.",
  },
  {
    icon: "videocam-outline",
    headline: "Go live, instantly",
    body: "Share what's happening right now. Go live for your followers, or just the people nearby.",
  },
  {
    icon: "at-outline",
    headline: "Connect in a tap",
    body: "Every profile has a WAY ID. Share yours, scan theirs, and you're connected — no searching required.",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  async function finish() {
    await markOnboardingSeen();
    router.replace("/welcome");
  }

  function handleNext() {
    if (isLast) {
      finish();
      return;
    }
    const nextIndex = index + 1;
    scrollRef.current?.scrollTo({ x: nextIndex * SCREEN_WIDTH, animated: true });
    setIndex(nextIndex);
  }

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(next);
  }

  return (
    <View style={styles.container}>
      <OceanWavesBackground source={require("../../assets/onboarding-waves.mp4")} tone="deep" />

      {!isLast && (
        <Pressable style={styles.skip} onPress={finish} hitSlop={12}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      )}

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
      >
        {SLIDES.map((slide) => (
          <View key={slide.headline} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={styles.badgeGlow}>
              <View style={styles.badge}>
                <Ionicons name={slide.icon} size={56} color={colors.textOnPrimary} />
              </View>
            </View>
            <Text style={styles.headline}>{slide.headline}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <View key={slide.headline} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <DotOutline radius={radii.pill} tone="onLight" style={styles.buttonWrap}>
          <Pressable style={styles.button} onPress={handleNext}>
            <Text style={styles.buttonText}>{isLast ? "Get Started" : "Next"}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.primaryDark} />
          </Pressable>
        </DotOutline>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skip: {
    position: "absolute",
    top: spacing.xxl,
    right: spacing.lg,
    zIndex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  skipText: { ...typography.body, ...legibleText("onDark"), fontWeight: "600" },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  // Wraps the badge to carry the halo as its own shadow — layering it on
  // the badge directly got clipped by the badge's own border/background,
  // reading as a thin rim instead of the Welcome logo's visible bloom.
  badgeGlow: {
    marginBottom: spacing.xl,
    borderRadius: radii.pill,
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 30,
    elevation: 20,
  },
  badge: {
    width: 128,
    height: 128,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.7)",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headline: { ...typography.h1, ...legibleText("onDark"), textAlign: "center", marginBottom: spacing.sm },
  body: { ...typography.body, ...legibleText("onDark"), textAlign: "center", opacity: 0.9 },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: "center",
  },
  dots: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.lg },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  dotActive: { backgroundColor: colors.warning, width: 20 },
  buttonWrap: { width: "100%" },
  button: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.warning,
    borderWidth: 1,
    borderColor: "rgba(6, 46, 56, 0.18)",
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: colors.primaryDark, fontWeight: "700", fontSize: 16 },
});
