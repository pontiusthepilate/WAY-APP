import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../theme/theme";
import { RadarView } from "../../components/RadarView";
import { ConnectionRow } from "../../components/ConnectionRow";
import { ConnectionGridItem } from "../../components/ConnectionGridItem";
import { ViewToggle } from "../../components/ViewToggle";
import { SearchModeTabs } from "../../components/SearchModeTabs";
import { RadiusPicker } from "../../components/RadiusPicker";
import { MiniProfileModal } from "../../components/MiniProfileModal";
import { SkyOceanBackground } from "../../components/SkyOceanBackground";
import { DotOutline } from "../../components/DotOutline";
import { CountryCodeDivider, CountryCodeTrigger, CountryPickerSheet } from "../../components/CountryCodePicker";
import { useSession } from "../../context/SessionContext";
import { useDeviceLocation } from "../../lib/useDeviceLocation";
import { DEFAULT_COUNTRY, type Country } from "../../lib/countries";
import { searchAddress, searchAll, searchByWayId, searchLocation, searchNearby } from "../../api/search";
import { startConversation } from "../../api/messages";
import { updateVisibility } from "../../api/profiles";
import { getActiveStatusIds } from "../../api/status";
import type { NearbyResult, ResultView, SearchMode, UnifiedSearchResults } from "../../types";
import { ApiError } from "../../api/client";

const RADAR_SIZE = Math.min(Dimensions.get("window").width - spacing.xl * 2, 340);

// Mirrors the backend's own PHONE_LIKE check (search.ts) — a query that
// starts with a digit (or a leading "+") is treated as a phone number, so
// the country-code trigger only shows up when it'd actually apply, not
// while someone's typing a WAY ID.
function looksLikePhone(value: string): boolean {
  return /^\+?[0-9]/.test(value.trim());
}

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeProfile, refreshProfiles } = useSession();
  const { coords, refresh: refreshDeviceLocation, loading: locating } = useDeviceLocation();

  const [mode, setMode] = useState<SearchMode>("nearby");
  const [view, setView] = useState<ResultView>("radar");
  const [radiusMeters, setRadiusMeters] = useState(500);
  const [category, setCategory] = useState("");
  const [addressText, setAddressText] = useState("");
  const [locationText, setLocationText] = useState("");
  const [wayIdText, setWayIdText] = useState("");
  const [wayIdCountry, setWayIdCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [allQueryText, setAllQueryText] = useState("");
  const [unifiedResults, setUnifiedResults] = useState<UnifiedSearchResults | null>(null);

  const [results, setResults] = useState<NearbyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NearbyResult | null>(null);
  const [statusAuthorIds, setStatusAuthorIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getActiveStatusIds(results.map((r) => r.id))
      .then((ids) => setStatusAuthorIds(new Set(ids)))
      .catch(() => setStatusAuthorIds(new Set()));
  }, [results]);

  // MiniProfileModal is a plain in-tree overlay, not a native Modal, so it no
  // longer covers the floating tab bar on its own (that's a sibling of this
  // screen inside the tab navigator, painted after it) — hide the tab bar
  // for as long as the sheet is up so it can't show or capture taps through it.
  const navigation = useNavigation();
  useEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: selected ? { display: "none" } : undefined });
    return () => parent?.setOptions({ tabBarStyle: undefined });
  }, [selected, navigation]);

  useEffect(() => {
    if (mode === "nearby") refreshDeviceLocation();
  }, [mode, refreshDeviceLocation]);

  useEffect(() => {
    // Resets stale results/errors from the previous mode, and steers off the
    // radar view for WAY ID mode (whose results have no distance/bearing,
    // the two numbers radar placement depends on).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResults([]);
    setUnifiedResults(null);
    setError(null);
    if (mode === "wayid" && view === "radar") setView("list");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const runSearch = useCallback(async () => {
    if (!activeProfile) return;
    setLoading(true);
    setError(null);
    try {
      let next: NearbyResult[] = [];
      if (mode === "nearby") {
        const point = coords ?? (await refreshDeviceLocation());
        if (!point) {
          setError("Turn on location access to search nearby.");
          return;
        }
        next = await searchNearby({ profileId: activeProfile.id, radiusMeters, category: category || undefined, ...point });
      } else if (mode === "address") {
        if (!addressText.trim()) {
          setError("Enter a street address to search.");
          return;
        }
        next = await searchAddress({
          profileId: activeProfile.id,
          address: addressText.trim(),
          radiusMeters,
          category: category || undefined,
        });
      } else if (mode === "location") {
        if (!locationText.trim()) {
          setError("Enter a place, city, state, or country to search.");
          return;
        }
        next = await searchLocation({
          profileId: activeProfile.id,
          query: locationText.trim(),
          radiusMeters,
          category: category || undefined,
        });
      } else if (mode === "wayid") {
        const trimmed = wayIdText.trim();
        if (!trimmed) {
          setError("Enter a WAY ID or phone number to search.");
          return;
        }
        // A bare national number needs the selected country's dial code
        // prefixed to match how it's stored — the same E.164 format
        // sign-in resolves phone numbers to.
        const query = looksLikePhone(trimmed) && !trimmed.startsWith("+")
          ? `+${wayIdCountry.dialCode}${trimmed.replace(/\D/g, "")}`
          : trimmed;
        next = await searchByWayId({ profileId: activeProfile.id, query });
        if (next.length === 0) setError("No WAY found with that ID or phone number.");
      } else {
        const trimmed = allQueryText.trim();
        if (!trimmed) {
          setError("Enter a name, business, or podcast to search.");
          return;
        }
        const unified = await searchAll({ profileId: activeProfile.id, query: trimmed });
        setUnifiedResults(unified);
        // No setError here even when everything comes back empty — the
        // dedicated empty state below (driven by unifiedResults itself)
        // already covers it; setting one too would show the message twice.
        next = [...unified.people, ...unified.businesses, ...unified.podcasts];
      }
      setResults(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }, [activeProfile, mode, coords, radiusMeters, category, addressText, locationText, wayIdText, wayIdCountry, allQueryText, refreshDeviceLocation]);

  useEffect(() => {
    // Runs the search in response to the device location or mode changing;
    // that's the "external system" this effect synchronizes with.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (mode === "nearby" && coords) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, mode]);

  // Jumps from a unified-search location suggestion straight into Location
  // mode, already centered there — reuses the lat/lng this search already
  // resolved instead of re-geocoding the same text a second time.
  async function jumpToLocation(loc: { lat: number; lng: number; label: string }) {
    if (!activeProfile) return;
    setMode("location");
    setLocationText(loc.label);
    setLoading(true);
    setError(null);
    try {
      const next = await searchLocation({ profileId: activeProfile.id, lat: loc.lat, lng: loc.lng, radiusMeters, category: category || undefined });
      setResults(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleVisibility(next: boolean) {
    if (!activeProfile) return;
    await updateVisibility(activeProfile.id, { isVisible: next });
    await refreshProfiles();
  }

  function openRequest(result: NearbyResult) {
    router.push({ pathname: "/way-request", params: { toWayId: result.wayId, toDisplayName: result.displayName } });
  }

  function openCameraRequest(result: NearbyResult) {
    router.push({ pathname: "/request-camera", params: { toWayId: result.wayId, toDisplayName: result.displayName } });
  }

  async function openMessage(result: NearbyResult) {
    if (!activeProfile) return;
    const conversation = await startConversation(activeProfile.id, result.id);
    router.push(`/messages/${conversation.id}`);
  }

  return (
    <View style={styles.container}>
      <SkyOceanBackground tone="pale" />
      <View style={[styles.header, { paddingTop: spacing.lg + insets.top }]}>
        <View>
          <Text style={styles.headerTitle}>WAY</Text>
          <Text style={styles.headerSubtitle}>{activeProfile ? `WAY/${activeProfile.wayId}` : ""}</Text>
        </View>
        <View style={styles.visibilityRow}>
          <Text style={styles.visibilityLabel}>{activeProfile?.isVisible ? "Visible" : "Hidden"}</Text>
          <Switch
            value={activeProfile?.isVisible ?? true}
            onValueChange={toggleVisibility}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
      </View>

      <View style={styles.controls}>
        <SearchModeTabs value={mode} onChange={setMode} />

        {mode === "address" && (
          <View style={styles.inputWrap}>
            <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Street address, anywhere on earth"
              placeholderTextColor={colors.textSecondary}
              value={addressText}
              onChangeText={setAddressText}
              onSubmitEditing={runSearch}
            />
          </View>
        )}
        {mode === "location" && (
          <View style={styles.inputWrap}>
            <Ionicons name="earth-outline" size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Place, city, state, county, or country"
              placeholderTextColor={colors.textSecondary}
              value={locationText}
              onChangeText={setLocationText}
              onSubmitEditing={runSearch}
            />
          </View>
        )}
        {mode === "all" && (
          <View style={styles.inputWrap}>
            <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Search people, businesses, podcasts…"
              placeholderTextColor={colors.textSecondary}
              value={allQueryText}
              onChangeText={setAllQueryText}
              onSubmitEditing={runSearch}
            />
          </View>
        )}
        {mode === "wayid" && (
          <>
            <View style={styles.inputWrap}>
              {looksLikePhone(wayIdText) ? (
                <>
                  <CountryCodeTrigger value={wayIdCountry} onPress={() => setCountryPickerOpen(true)} />
                  <CountryCodeDivider />
                </>
              ) : (
                <Ionicons name="at-outline" size={18} color={colors.textSecondary} />
              )}
              <TextInput
                style={styles.input}
                placeholder="WAY ID (username) or phone number"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                value={wayIdText}
                onChangeText={setWayIdText}
                onSubmitEditing={runSearch}
              />
            </View>
            <CountryPickerSheet
              open={countryPickerOpen}
              onClose={() => setCountryPickerOpen(false)}
              onSelect={(c) => {
                setWayIdCountry(c);
                setCountryPickerOpen(false);
              }}
            />
          </>
        )}

        {mode !== "wayid" && mode !== "all" && (
          <View style={styles.inputWrap}>
            <Ionicons name="pricetag-outline" size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Category / interest (optional)"
              placeholderTextColor={colors.textSecondary}
              value={category}
              onChangeText={setCategory}
            />
          </View>
        )}

        {mode !== "wayid" && mode !== "all" && <RadiusPicker value={radiusMeters} onChange={setRadiusMeters} />}

        {mode !== "nearby" && (
          <View style={styles.searchRow}>
            <DotOutline radius={radii.pill} tone="onDark" style={styles.searchButtonWrap}>
              <Pressable style={styles.searchButton} onPress={runSearch}>
                <Text style={styles.searchButtonText}>Search</Text>
                <Ionicons name="search-outline" size={18} color={colors.textOnPrimary} />
              </Pressable>
            </DotOutline>
            {mode === "wayid" && (
              <Pressable style={styles.scanButton} onPress={() => router.push("/scan")} hitSlop={8}>
                <Ionicons name="qr-code-outline" size={22} color={colors.primaryDark} />
              </Pressable>
            )}
          </View>
        )}

        {mode !== "all" && <ViewToggle value={view} onChange={setView} />}
      </View>

      {(loading || locating) && <ActivityIndicator style={styles.spinner} color={colors.primaryDark} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && mode !== "all" && results.length === 0 && (
        <Text style={styles.empty}>No connections found in this radius yet.</Text>
      )}

      {mode === "all" ? (
        <ScrollView style={styles.unifiedList} contentContainerStyle={styles.listPadding} keyboardShouldPersistTaps="handled">
          {unifiedResults?.location && (
            <Pressable style={styles.locationShortcut} onPress={() => jumpToLocation(unifiedResults.location!)}>
              <Ionicons name="earth-outline" size={20} color={colors.primaryDark} />
              <Text style={styles.locationShortcutText}>{`Search near "${unifiedResults.location.label}"`}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.primaryDark} />
            </Pressable>
          )}
          {unifiedResults && unifiedResults.people.length > 0 && (
            <View style={styles.unifiedSection}>
              <Text style={styles.sectionTitle}>People</Text>
              {unifiedResults.people.map((r) => (
                <ConnectionRow key={r.id} result={r} onPress={() => setSelected(r)} hasActiveStatus={statusAuthorIds.has(r.id)} />
              ))}
            </View>
          )}
          {unifiedResults && unifiedResults.businesses.length > 0 && (
            <View style={styles.unifiedSection}>
              <Text style={styles.sectionTitle}>Businesses</Text>
              {unifiedResults.businesses.map((r) => (
                <ConnectionRow key={r.id} result={r} onPress={() => setSelected(r)} hasActiveStatus={statusAuthorIds.has(r.id)} />
              ))}
            </View>
          )}
          {unifiedResults && unifiedResults.podcasts.length > 0 && (
            <View style={styles.unifiedSection}>
              <Text style={styles.sectionTitle}>Podcasts</Text>
              {unifiedResults.podcasts.map((r) => (
                <ConnectionRow key={r.id} result={r} onPress={() => setSelected(r)} hasActiveStatus={statusAuthorIds.has(r.id)} />
              ))}
            </View>
          )}
          {unifiedResults &&
            !unifiedResults.location &&
            unifiedResults.people.length === 0 &&
            unifiedResults.businesses.length === 0 &&
            unifiedResults.podcasts.length === 0 && <Text style={styles.empty}>No matches found.</Text>}
        </ScrollView>
      ) : (
      <View style={styles.resultsArea}>
        {view === "radar" && (
          <View style={styles.radarWrap}>
            <RadarView
              results={results}
              radiusMeters={radiusMeters}
              size={RADAR_SIZE}
              onSelect={setSelected}
              statusAuthorIds={statusAuthorIds}
            />
          </View>
        )}
        {view === "list" && (
          <FlatList
            data={results}
            keyExtractor={(r) => r.id}
            contentContainerStyle={styles.listPadding}
            renderItem={({ item }) => (
              <ConnectionRow result={item} onPress={() => setSelected(item)} hasActiveStatus={statusAuthorIds.has(item.id)} />
            )}
          />
        )}
        {view === "grid" && (
          <FlatList
            data={results}
            keyExtractor={(r) => r.id}
            numColumns={2}
            contentContainerStyle={styles.listPadding}
            renderItem={({ item }) => (
              <ConnectionGridItem result={item} onPress={() => setSelected(item)} hasActiveStatus={statusAuthorIds.has(item.id)} />
            )}
          />
        )}
      </View>
      )}

      <MiniProfileModal
        result={selected}
        onClose={() => setSelected(null)}
        onSendRequest={openRequest}
        onRequestCamera={openCameraRequest}
        onMessage={openMessage}
        onOpenProfile={setSelected}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listPadding: { paddingBottom: 110 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitle: { ...typography.h1, color: colors.primaryDark },
  headerSubtitle: { ...typography.caption, color: colors.textSecondary },
  visibilityRow: { alignItems: "center" },
  visibilityLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: 2 },
  controls: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  unifiedList: { flex: 1, paddingHorizontal: spacing.lg },
  unifiedSection: { marginTop: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  locationShortcut: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  locationShortcutText: { flex: 1, ...typography.body, color: colors.primaryDark, fontWeight: "600" },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
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
  searchRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  searchButtonWrap: { flex: 1 },
  searchButton: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.horizonDeep,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  scanButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  searchButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  spinner: { marginTop: spacing.md },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.sm, ...typography.caption },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.md, ...typography.body },
  resultsArea: { flex: 1, marginTop: spacing.sm },
  // The bottom tab bar floats over the content (see (tabs)/_layout.tsx)
  // rather than pushing it up, so centering across the full flex:1 height
  // would center behind it. The same paddingBottom the list/grid views
  // already use (listPadding) keeps the center point in the space that's
  // actually visible above the tab bar.
  radarWrap: { alignItems: "center", justifyContent: "center", flex: 1, paddingBottom: 110 },
});
