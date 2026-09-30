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

  radarRing: "#D7E5E8",
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
