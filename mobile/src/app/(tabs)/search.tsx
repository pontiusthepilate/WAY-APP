import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
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
import { searchAddress, searchByWayId, searchLocation, searchNearby } from "../../api/search";
import { updateVisibility } from "../../api/profiles";
import type { NearbyResult, ResultView, SearchMode } from "../../types";
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

  const [results, setResults] = useState<NearbyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NearbyResult | null>(null);

  useEffect(() => {
    if (mode === "nearby") refreshDeviceLocation();
  }, [mode, refreshDeviceLocation]);

  useEffect(() => {
    // Resets stale results/errors from the previous mode, and steers off the
    // radar view for WAY ID mode (whose results have no distance/bearing,
    // the two numbers radar placement depends on).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResults([]);
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
      } else {
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
      }
      setResults(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }, [activeProfile, mode, coords, radiusMeters, category, addressText, locationText, wayIdText, wayIdCountry, refreshDeviceLocation]);

  useEffect(() => {
    // Runs the search in response to the device location or mode changing;
    // that's the "external system" this effect synchronizes with.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (mode === "nearby" && coords) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, mode]);

  async function toggleVisibility(next: boolean) {
    if (!activeProfile) return;
    await updateVisibility(activeProfile.id, { isVisible: next });
    await refreshProfiles();
  }

  function openRequest(result: NearbyResult) {
    setSelected(null);
    router.push({ pathname: "/way-request", params: { toWayId: result.wayId, toDisplayName: result.displayName } });
  }

  function openCameraRequest(result: NearbyResult) {
    setSelected(null);
    router.push({ pathname: "/request-camera", params: { toWayId: result.wayId, toDisplayName: result.displayName } });
  }

  return (
    <View style={styles.container}>
      <SkyOceanBackground tone="pale" />
      <View style={styles.header}>
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

        {mode !== "wayid" && (
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

        {mode !== "wayid" && <RadiusPicker value={radiusMeters} onChange={setRadiusMeters} />}

        {mode !== "nearby" && (
          <DotOutline radius={radii.pill} tone="onDark">
            <Pressable style={styles.searchButton} onPress={runSearch}>
              <Text style={styles.searchButtonText}>Search</Text>
              <Ionicons name="search-outline" size={18} color={colors.textOnPrimary} />
            </Pressable>
          </DotOutline>
        )}

        <ViewToggle value={view} onChange={setView} />
      </View>

      {(loading || locating) && <ActivityIndicator style={styles.spinner} color={colors.primaryDark} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && results.length === 0 && (
        <Text style={styles.empty}>No connections found in this radius yet.</Text>
      )}

      <View style={styles.resultsArea}>
        {view === "radar" && (
          <View style={styles.radarWrap}>
            <RadarView results={results} radiusMeters={radiusMeters} size={RADAR_SIZE} onSelect={setSelected} />
          </View>
        )}
        {view === "list" && (
          <FlatList
            data={results}
            keyExtractor={(r) => r.id}
            contentContainerStyle={styles.listPadding}
            renderItem={({ item }) => <ConnectionRow result={item} onPress={() => setSelected(item)} />}
          />
        )}
        {view === "grid" && (
          <FlatList
            data={results}
            keyExtractor={(r) => r.id}
            numColumns={2}
            contentContainerStyle={styles.listPadding}
            renderItem={({ item }) => <ConnectionGridItem result={item} onPress={() => setSelected(item)} />}
          />
        )}
      </View>

      <MiniProfileModal
        result={selected}
        onClose={() => setSelected(null)}
        onSendRequest={openRequest}
        onRequestCamera={openCameraRequest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listPadding: { paddingBottom: 90 },
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
  searchButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  spinner: { marginTop: spacing.md },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.sm, ...typography.caption },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.md, ...typography.body },
  resultsArea: { flex: 1, marginTop: spacing.sm },
  radarWrap: { alignItems: "center", justifyContent: "center", flex: 1 },
});
