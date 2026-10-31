// Matches the WAY Brand Guidelines (2026) color palette — deep teal primary,
// ocean-horizon secondary/tertiary teals, gold + coral accents — laid out on
// a light, airy ground per the brand's logo-on-white usage.
export const colors = {
  background: "#F3F8F9",
  surface: "#FFFFFF",
  surfaceAlt: "#E7EFF1",

  primary: "#0A4554", // brand Primary Color
  primaryDark: "#062E38", // brand Tertiary Color
  primaryLight: "#CFE0E4",

  horizon: "#2F6F7C", // brand Secondary Color — where the sky meets the ocean
  horizonDeep: "#0A4554",

  textPrimary: "#102A31",
  textSecondary: "#5C7680",
  textOnPrimary: "#FFFFFF",

  border: "#D7E5E8",
  divider: "#E7F0F1",

  danger: "#F26A5B", // brand Accent Color (coral)
  warning: "#E6B655", // brand Accent Color (gold)

  radarRing: "rgba(10, 69, 84, 0.3)", // was too close to the background/border color to actually read
  radarSweep: "rgba(10, 69, 84, 0.14)",
};

export const gradients = {
  cloudHorizon: [colors.background, colors.primaryLight, colors.horizon] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radii = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const, fontFamily: "Gabarito_700Bold" },
  h2: { fontSize: 22, fontWeight: "700" as const, fontFamily: "Gabarito_700Bold" },
  h3: { fontSize: 17, fontWeight: "600" as const, fontFamily: "Gabarito_600SemiBold" },
  body: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },
};

// Text drawn straight over a photographic background (no solid card behind
// it) can't rely on a single fixed color for contrast — the photo's
// brightness varies by region and by tone. This picks the color automatically
// from which side of the photo it's sitting on, and backs it with a
// same-direction shadow "halo", which is what actually keeps it legible when
// it passes over a brighter or busier patch of the image: the shadow darkens
// (or lightens) only the pixels right behind the glyphs, so it adjusts itself
// per-letter without needing to know what's actually behind them.
export type PhotoTextSide = "onLight" | "onDark";

export function legibleText(side: PhotoTextSide) {
  return side === "onDark"
    ? {
        color: colors.textOnPrimary,
        textShadowColor: "rgba(6, 46, 56, 0.85)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
      }
    : {
        color: colors.textPrimary,
        textShadowColor: "rgba(255, 255, 255, 0.85)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
      };
}
