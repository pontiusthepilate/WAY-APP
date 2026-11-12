import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { colors, legibleText, radii, spacing, typography } from "../theme/theme";
import { createProfile, getProfileByWay } from "../api/profiles";
import {
  getPodcastPlan,
  getPodcastStatus,
  initializePodcastSubscription,
  verifyPodcastSubscription,
  type PodcastPlan,
  type PodcastStatus,
} from "../api/subscriptions";
import { formatCurrency } from "../lib/formatCurrency";
import { ApiError } from "../api/client";
import { useSession } from "../context/SessionContext";
import { OceanWavesBackground } from "../components/OceanWavesBackground";
import { DotOutline } from "../components/DotOutline";

type Kind = "personal" | "business" | "podcast";

const KINDS: { key: Kind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "personal", label: "Personal", icon: "person-outline" },
  { key: "business", label: "Business", icon: "shield-checkmark-outline" },
  { key: "podcast", label: "Podcast", icon: "mic-outline" },
];

const PODCAST_CALLBACK_URL = "way://podcast-subscribe-callback";

// Mirrors backend/src/lib/wayId.ts's WAY_ID_PATTERN — the mobile app has no
// package shared with the backend, so this is kept in sync by hand.
const WAY_ID_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;

type WayIdStatus = "idle" | "invalid" | "checking" | "available" | "taken" | "error";

const WAY_ID_STATUS_MESSAGE: Partial<Record<WayIdStatus, string>> = {
  invalid: "3-20 characters, starting with a letter — lowercase letters, numbers, underscore",
  taken: "That WAY is already taken",
  available: "It's yours — nice pick!",
  error: "Couldn't check availability right now",
};

// Mirrors backend/src/routes/profiles.ts's createProfileBody displayName
// max length.
const DISPLAY_NAME_MAX_LENGTH = 40;

export default function CreateProfileScreen() {
  const router = useRouter();
  const [wayId, setWayId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [kind, setKind] = useState<Kind>("personal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wayIdStatus, setWayIdStatus] = useState<WayIdStatus>("idle");
  // Surfaced here rather than left to Privacy settings since this is new
  // reachability a signup brings with it (people search is now possible).
  // Whether a found/connected profile's actual number gets shown is never
  // general — that's decided per-connection, at accept time or later on
  // that person's own profile page (see way-request/[id].tsx, profile/[id].tsx).
  const [discoverableByPhone, setDiscoverableByPhone] = useState(true);
  const [podcastPlan, setPodcastPlan] = useState<PodcastPlan | null>(null);
  const [podcastStatus, setPodcastStatus] = useState<PodcastStatus | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const { refreshProfiles, profiles } = useSession();

  const freeSlotsLeft = 2 - profiles.filter((p) => p.kind !== "podcast").length;
  const needsPodcastSubscription =
    kind === "podcast" && !!podcastStatus && podcastStatus.usedSlots >= podcastStatus.activeSlots;

  // Podcast is never free — fetch the live price/entitlement the moment it's
  // picked, so the paywall (or the all-clear) shows immediately rather than
  // waiting to find out via a failed /profiles call.
  useEffect(() => {
    if (kind !== "podcast" || podcastPlan) return;
    getPodcastPlan()
      .then(setPodcastPlan)
      .catch(() => {});
    getPodcastStatus()
      .then(setPodcastStatus)
      .catch(() => {});
  }, [kind, podcastPlan]);

  async function handleSubscribe() {
    setError(null);
    setSubscribing(true);
    try {
      const { authorizationUrl, reference } = await initializePodcastSubscription();
      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, PODCAST_CALLBACK_URL);
      if (result.type !== "success") {
        setError("Subscription was cancelled.");
        return;
      }
      const verified = await verifyPodcastSubscription(reference);
      if (verified.status !== "active") {
        setError(verified.error || "Subscription was not successful.");
        return;
      }
      setPodcastStatus(await getPodcastStatus());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the subscription.");
    } finally {
      setSubscribing(false);
    }
  }

  // Debounced live availability check — only hits the network once the
  // format is already valid, and ignores a stale response if the field
  // changed again before it came back.
  useEffect(() => {
    if (!wayId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWayIdStatus("idle");
      return;
    }
    if (!WAY_ID_PATTERN.test(wayId)) {
      setWayIdStatus("invalid");
      return;
    }
    setWayIdStatus("checking");
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        await getProfileByWay(wayId);
        if (!cancelled) setWayIdStatus("taken");
      } catch (err) {
        if (cancelled) return;
        setWayIdStatus(err instanceof ApiError && err.status === 404 ? "available" : "error");
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wayId]);

  async function handleCreate() {
    if (needsPodcastSubscription) return;
    setError(null);
    setLoading(true);
    try {
      await createProfile({
        wayId: wayId.trim(),
        displayName: displayName.trim(),
        kind,
        discoverableByPhone,
      });
      await refreshProfiles();
      router.replace("/feed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create that profile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <OceanWavesBackground source={require("../../assets/ocean-waves-welcome.mp4")} tone="pale" />
      <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Choose your WAY</Text>
      <Text style={styles.subtitle}>
        This is what people will ask you for socially — &ldquo;what&apos;s your WAY?&rdquo; — instead of a username.
        {"\n"}You have {freeSlotsLeft} free profile{freeSlotsLeft === 1 ? "" : "s"} left.
      </Text>

      <Text style={styles.label}>Your WAY</Text>
      <View style={styles.wayInputWrap}>
        <Ionicons name="at-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.wayInput}
          placeholder="yourname"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          value={wayId}
          onChangeText={(v) => setWayId(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
        />
        {wayIdStatus === "checking" && <ActivityIndicator size="small" color={colors.textSecondary} />}
        {wayIdStatus === "available" && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
        {(wayIdStatus === "invalid" || wayIdStatus === "taken") && (
          <Ionicons name="close-circle" size={20} color={colors.danger} />
        )}
      </View>
      {!!WAY_ID_STATUS_MESSAGE[wayIdStatus] && (
        <Text style={[styles.wayIdHint, wayIdStatus === "available" && styles.wayIdHintAvailable]}>
          {WAY_ID_STATUS_MESSAGE[wayIdStatus]}
        </Text>
      )}

      <View style={styles.phonePrivacyBox}>
        <Text style={styles.phonePrivacyTitle}>Phone number privacy</Text>
        <View style={styles.phonePrivacyRow}>
          <Text style={styles.phonePrivacyLabel}>Let people who have your number find your WAY</Text>
          <Switch
            value={discoverableByPhone}
            onValueChange={setDiscoverableByPhone}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
        <Text style={styles.phonePrivacyHint}>
          You can change this later in Privacy settings. Your actual number is only ever shown to someone you&apos;ve
          connected with, and only if you choose to share it with them specifically.
        </Text>
      </View>

      <Text style={styles.label}>Display name</Text>
      <View style={styles.inputWrap}>
        <Ionicons name="person-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="How you'll appear to others"
          placeholderTextColor={colors.textSecondary}
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
        />
        <Text style={[styles.charCount, displayName.length === DISPLAY_NAME_MAX_LENGTH && styles.charCountMax]}>
          {displayName.length}/{DISPLAY_NAME_MAX_LENGTH}
        </Text>
      </View>

      <Text style={styles.label}>Profile type</Text>
      <View style={styles.kindRow}>
        {KINDS.map((k) => (
          <Pressable
            key={k.key}
            style={[styles.kindPill, kind === k.key && styles.kindPillActive]}
            onPress={() => setKind(k.key)}
          >
            <Ionicons
              name={k.icon}
              size={14}
              color={kind === k.key ? colors.textOnPrimary : colors.textSecondary}
              style={styles.kindIcon}
            />
            <Text style={[styles.kindLabel, kind === k.key && styles.kindLabelActive]}>{k.label}</Text>
          </Pressable>
        ))}
      </View>

      {needsPodcastSubscription && (
        <View style={styles.paywall}>
          <Ionicons name="mic" size={20} color={colors.primary} />
          <Text style={styles.paywallTitle}>Podcast profiles aren&apos;t free</Text>
          <Text style={styles.paywallBody}>
            {podcastPlan
              ? `${formatCurrency(podcastPlan.amount, podcastPlan.currency as any)} / ${podcastPlan.interval} unlocks one podcast profile.`
              : "Checking the current price…"}
          </Text>
          <Pressable
            style={[styles.subscribeButton, subscribing && styles.buttonDisabled]}
            disabled={subscribing || !podcastPlan}
            onPress={handleSubscribe}
          >
            {subscribing ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.subscribeButtonText}>Subscribe</Text>
            )}
          </Pressable>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <DotOutline radius={radii.pill} tone="onDark" style={styles.buttonSpacing}>
        <Pressable
          style={[
            styles.button,
            (wayIdStatus !== "available" || !displayName || loading || needsPodcastSubscription) && styles.buttonDisabled,
          ]}
          disabled={wayIdStatus !== "available" || !displayName || loading || needsPodcastSubscription}
          onPress={handleCreate}
        >
          {loading ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <>
              <Text style={styles.buttonText}>Create profile</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.textOnPrimary} />
            </>
          )}
        </Pressable>
      </DotOutline>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flexGrow: 1, padding: spacing.xl, justifyContent: "center" },
  title: { ...typography.h1, ...legibleText("onLight"), textAlign: "center" },
  subtitle: {
    ...typography.body,
    ...legibleText("onLight"),
    color: colors.textPrimary,
    fontWeight: "600",
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  label: { ...typography.caption, ...legibleText("onLight"), marginBottom: spacing.xs, marginTop: spacing.md },
  wayInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(16, 42, 49, 0.08)",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
  inputIcon: { marginRight: spacing.xs },
  wayInput: { flex: 1, paddingVertical: spacing.sm, ...typography.body, color: colors.textPrimary },
  wayIdHint: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  wayIdHintAvailable: { color: colors.primary },
  phonePrivacyBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  phonePrivacyTitle: { ...typography.caption, color: colors.textSecondary, fontWeight: "700", textTransform: "uppercase" },
  phonePrivacyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  phonePrivacyLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
  phonePrivacyHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(16, 42, 49, 0.08)",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  charCount: { ...typography.caption, color: colors.textSecondary },
  charCountMax: { color: colors.danger },
  kindRow: { flexDirection: "row", gap: spacing.sm },
  kindPill: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  kindPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  kindIcon: { marginRight: 4 },
  kindLabel: { color: colors.textSecondary, fontWeight: "600" },
  kindLabelActive: { color: colors.textOnPrimary },
  paywall: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(16, 42, 49, 0.08)",
    alignItems: "center",
    gap: 4,
  },
  paywallTitle: { ...typography.body, color: colors.textPrimary, fontWeight: "700" },
  paywallBody: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
  subscribeButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  subscribeButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  error: { color: colors.danger, marginTop: spacing.md, ...typography.caption, textAlign: "center" },
  buttonSpacing: { marginTop: spacing.xl },
  button: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 16 },
});
