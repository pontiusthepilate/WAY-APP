import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { RadiusPicker } from "../../components/RadiusPicker";
import { MiniProfileModal } from "../../components/MiniProfileModal";
import { EventSearchPanel } from "../../components/EventSearchPanel";
import { SkyOceanBackground } from "../../components/SkyOceanBackground";
import { CountryCodeDivider, CountryCodeTrigger, CountryPickerSheet } from "../../components/CountryCodePicker";
import { CategoryPickerSheet } from "../../components/CategoryPicker";
import { useSession } from "../../context/SessionContext";
import { useDeviceLocation } from "../../lib/useDeviceLocation";
import { DEFAULT_COUNTRY, type Country } from "../../lib/countries";
import { parseSearchQuery, searchAddress, searchAll, searchByWayId, searchLocation, searchNearby } from "../../api/search";
import { MapPickerModal } from "../../components/MapPickerModal";
import { AddressSearchSheet } from "../../components/AddressSearchSheet";
import { INTERESTS } from "../../lib/interests";
import { useSearchLanguage } from "../../lib/useLocale";
import { startConversation } from "../../api/messages";
import { updateVisibility } from "../../api/profiles";
import { getActiveStatusIds } from "../../api/status";
import { getHasSeenAccessGrantNudge, markAccessGrantNudgeSeen } from "../../lib/accessGrantNudge";
import type { NearbyResult, ResultView, SearchMode, UnifiedSearchResults } from "../../types";
import { ApiError } from "../../api/client";

const RADAR_SIZE = Math.min(Dimensions.get("window").width - spacing.xl * 2, 340);

// A small, representative slice of the full ~240-tag taxonomy
// (lib/interests.ts) for one-tap filtering right under the search box —
// the exhaustive, searchable list is still reachable via "More…"
// (CategoryPickerSheet), this row is just the fast path.
const QUICK_CATEGORIES = [
  "Hair & Hairstyling",
  "Makeup",
  "Photography",
  "Cooking",
  "Software Development",
  "Interior Design",
  "Gym & Weightlifting",
  "DJing",
  "Real Estate",
  "Tutoring & Mentorship",
  "Car Maintenance",
  "Nail Art",
];

// Mirrors the backend's own PHONE_LIKE check (search.ts) exactly — the
// WHOLE string has to be phone-shaped (digits plus spaces/dashes/parens/
// dots), not just start with a digit. A street address also starts with a
// digit (the house number), but as soon as a street/place name's letters
// show up, this correctly stops matching — e.g. "82" is still ambiguous,
// but "82 Karu site Abuja" no longer looks like a phone number.
const PHONE_LIKE = /^\+?[0-9][0-9\s\-().]{4,}$/;
function looksLikePhone(value: string): boolean {
  return PHONE_LIKE.test(value.trim());
}

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeProfile, refreshProfiles } = useSession();
  const { coords, refresh: refreshDeviceLocation, loading: locating } = useDeviceLocation();

  const [resultKind, setResultKind] = useState<"profiles" | "events">("profiles");
  // No mode tabs in the UI anymore — `mode` is purely derived, set
  // whenever a search resolves (AI classification, a tapped place
  // suggestion, a category chip, or a dropped map pin), and read back by
  // the radius-change re-run and by discoveredVia on connect/view actions.
  const [mode, setMode] = useState<SearchMode>("nearby");
  const [view, setView] = useState<ResultView>("radar");
  const [radiusMeters, setRadiusMeters] = useState(500);
  const [category, setCategory] = useState("");
  // The free-text "description" half of the last resolved search (from AI
  // classification or the category sheet's "Search people matching this
  // description" row) — kept so a radius-slider change can re-run the same
  // search rather than silently dropping it.
  const [describeText, setDescribeText] = useState("");
  // These three still hold whichever place/id text last actually resolved
  // the search, even though they're no longer separate visible fields —
  // runSearch's per-mode branches read from them directly when re-running
  // at a new radius.
  const [addressText, setAddressText] = useState("");
  const [locationText, setLocationText] = useState("");
  const [wayIdCountry, setWayIdCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [unifiedResults, setUnifiedResults] = useState<UnifiedSearchResults | null>(null);
  const language = useSearchLanguage();

  // Resolved coordinates from a map-pin drop or a unified-search location
  // shortcut (jumpToLocation/pickOnMap below) — cleared whenever the box's
  // text is hand-edited, so a re-run knows whether to reuse this point
  // directly or fall back to a fresh free-text geocode on the backend.
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  // The one search box — free text ("I want a hair stylist in Maitama
  // Abuja", "@johndoe", a street address…). Nothing here ever searches on
  // its own just because someone is typing — only the search button/Enter
  // (handleQuerySearch) or a tapped category chip/suggestion does.
  const [query, setQuery] = useState("");
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);

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

  // Purely local, offline filtering over the already-known category
  // taxonomy as someone types — no network call, and nothing here ever
  // triggers a search by itself. Tapping one just fills the box; the
  // actual search still only runs on the search button/Enter.
  const queryCategorySuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 || looksLikePhone(q)) return [];
    return INTERESTS.filter((i) => i.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((i) => i.name);
  }, [query]);

  // Re-runs whichever of nearby/address/location is currently resolved —
  // used by the initial "show what's nearby" effect below and by the radius
  // slider (which passes its new value directly rather than relying on
  // `radiusMeters` state, which wouldn't have re-rendered into this
  // closure yet in the same tick as the slider's own onChange).
  const runSearch = useCallback(async (radiusOverride?: number) => {
    if (!activeProfile) return;
    const radius = radiusOverride ?? radiusMeters;
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
        next = await searchNearby({
          profileId: activeProfile.id,
          radiusMeters: radius,
          category: category || undefined,
          describe: describeText || undefined,
          ...point,
        });
      } else if (mode === "address") {
        if (!addressText.trim() && !addressCoords) return;
        next = await searchAddress({
          profileId: activeProfile.id,
          ...(addressCoords ?? { address: addressText.trim() }),
          radiusMeters: radius,
          category: category || undefined,
          describe: describeText || undefined,
          language,
        });
      } else if (mode === "location") {
        if (!locationText.trim() && !locationCoords) return;
        next = await searchLocation({
          profileId: activeProfile.id,
          ...(locationCoords ?? { query: locationText.trim() }),
          radiusMeters: radius,
          category: category || undefined,
          describe: describeText || undefined,
          language,
        });
      } else {
        // wayid/all have no radius control — nothing to re-run here.
        return;
      }
      setResults(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }, [
    activeProfile,
    mode,
    coords,
    radiusMeters,
    category,
    describeText,
    addressText,
    addressCoords,
    locationText,
    locationCoords,
    language,
    refreshDeviceLocation,
  ]);

  useEffect(() => {
    // Shows "what's nearby" immediately on first load, before anyone types
    // anything — same default this screen has always had.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (mode === "nearby" && coords) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, mode]);

  function handleRadiusChange(next: number) {
    setRadiusMeters(next);
    runSearch(next);
  }

  // Runs a plain nearby search filtered by a category or a free-text
  // description — the "or choose the specific category" half of the single-
  // box design. Always resolves to nearby mode: without mode tabs, "near me"
  // is the one universal default a bare category/description tap can mean.
  // Executes directly (not via runSearch) since the state this just set
  // wouldn't have flowed through a render yet for runSearch's own closure.
  async function searchNearbyWith(params: { category?: string; describe?: string }) {
    if (!activeProfile) return;
    setQuery("");
    setMode("nearby");
    setCategory(params.category ?? "");
    setDescribeText(params.describe ?? "");
    setLoading(true);
    setError(null);
    try {
      const point = coords ?? (await refreshDeviceLocation());
      if (!point) {
        setError("Turn on location access to search nearby.");
        return;
      }
      const next = await searchNearby({
        profileId: activeProfile.id,
        radiusMeters,
        category: params.category || undefined,
        describe: params.describe || undefined,
        ...point,
      });
      setResults(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // Submits the single search box's free text — asks the backend's AI
  // classifier (lib/searchIntent.ts) which of the 5 underlying modes this
  // sentence implies, then searches with the fields it extracted. Mirrors
  // jumpToLocation/selectQuerySuggestion below, which also call the
  // search*/searchAll API functions directly with freshly-resolved values
  // rather than through runSearch's closure.
  async function handleQuerySearch() {
    const trimmed = query.trim();
    if (!trimmed || !activeProfile) return;
    setLoading(true);
    setError(null);
    try {
      const parsed = await parseSearchQuery(trimmed);
      setMode(parsed.mode);
      setCategory("");
      setDescribeText(parsed.describe ?? "");
      const radius = parsed.radiusMeters ?? radiusMeters;
      if (parsed.radiusMeters) setRadiusMeters(radius);

      let next: NearbyResult[] = [];
      if (parsed.mode === "nearby") {
        const point = coords ?? (await refreshDeviceLocation());
        if (!point) {
          setError("Turn on location access to search nearby.");
          return;
        }
        next = await searchNearby({ profileId: activeProfile.id, radiusMeters: radius, describe: parsed.describe ?? undefined, ...point });
      } else if (parsed.mode === "address") {
        const q = parsed.locationQuery ?? trimmed;
        setAddressText(q);
        setAddressCoords(null);
        next = await searchAddress({ profileId: activeProfile.id, address: q, radiusMeters: radius, describe: parsed.describe ?? undefined, language });
      } else if (parsed.mode === "location") {
        const q = parsed.locationQuery ?? trimmed;
        setLocationText(q);
        setLocationCoords(null);
        next = await searchLocation({ profileId: activeProfile.id, query: q, radiusMeters: radius, describe: parsed.describe ?? undefined, language });
      } else if (parsed.mode === "wayid") {
        const q0 = parsed.wayIdQuery ?? trimmed;
        const q = looksLikePhone(q0) && !q0.startsWith("+") ? `+${wayIdCountry.dialCode}${q0.replace(/\D/g, "")}` : q0;
        next = await searchByWayId({ profileId: activeProfile.id, query: q });
        if (next.length === 0) setError("No WAY found with that ID or phone number.");
      } else {
        const q = parsed.allQuery ?? trimmed;
        const unified = await searchAll({ profileId: activeProfile.id, query: q, language });
        setUnifiedResults(unified);
        next = [...unified.people, ...unified.businesses, ...unified.podcasts];
      }
      setResults(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // Jumps from a unified-search location suggestion straight into Location
  // mode, already centered there — reuses the lat/lng this search already
  // resolved instead of re-geocoding the same text a second time.
  async function jumpToLocation(loc: { lat: number; lng: number; label: string }) {
    if (!activeProfile) return;
    setMode("location");
    setQuery(loc.label);
    setLocationText(loc.label);
    setLocationCoords({ lat: loc.lat, lng: loc.lng });
    setCategory("");
    setDescribeText("");
    setLoading(true);
    setError(null);
    try {
      const next = await searchLocation({ profileId: activeProfile.id, lat: loc.lat, lng: loc.lng, radiusMeters, language });
      setResults(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // Confirms a dropped pin from MapPickerModal — a manually-placed pin reads
  // as "a general spot," not a verified street address, so it's always
  // classified as "location" (same "we already have a resolved point,
  // search on it directly" shape jumpToLocation above uses).
  async function pickOnMap(point: { lat: number; lng: number; label: string }) {
    setMapPickerOpen(false);
    if (!activeProfile) return;
    setMode("location");
    setQuery(point.label);
    setLocationText(point.label);
    setLocationCoords({ lat: point.lat, lng: point.lng });
    setCategory("");
    setDescribeText("");
    setLoading(true);
    setError(null);
    try {
      const next = await searchLocation({ profileId: activeProfile.id, lat: point.lat, lng: point.lng, radiusMeters, language });
      setResults(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // Resolves AddressSearchSheet's result — either an exact point from a
  // tapped Mapbox suggestion, or raw address text submitted without picking
  // one (the backend's own geocodeAddress handles that fallback, same as
  // any other free-typed address). Always classified as "address" — opening
  // this dedicated sheet is itself the deliberate "I want an exact address"
  // signal, no further classification needed.
  async function handleAddressResolved(result: { label: string; lat?: number; lng?: number }) {
    setAddressSheetOpen(false);
    if (!activeProfile) return;
    setMode("address");
    setQuery(result.label);
    setAddressText(result.label);
    setAddressCoords(result.lat != null && result.lng != null ? { lat: result.lat, lng: result.lng } : null);
    setCategory("");
    setDescribeText("");
    setLoading(true);
    setError(null);
    try {
      const next = await searchAddress({
        profileId: activeProfile.id,
        ...(result.lat != null && result.lng != null ? { lat: result.lat, lng: result.lng } : { address: result.label }),
        radiusMeters,
        language,
      });
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
    // One-time nudge toward the full-profile-access settings, right at the
    // point the user suggested — switching visibility on — rather than a
    // new sheet. Only fires once per install and only when turning ON.
    if (next && !(await getHasSeenAccessGrantNudge())) {
      await markAccessGrantNudgeSeen();
      Alert.alert("Full profile access", "Choose who can see your full profile once they connect.", [
        { text: "Not now" },
        { text: "Go to Privacy", onPress: () => router.push("/privacy") },
      ]);
    }
  }

  function openRequest(result: NearbyResult) {
    router.push({
      pathname: "/way-request",
      params: { toWayId: result.wayId, toDisplayName: result.displayName, discoveredVia: mode },
    });
  }

  function openViewProfile(result: NearbyResult) {
    router.push({ pathname: "/profile/[id]", params: { id: result.id, discoveredVia: mode } });
  }

  function openCameraRequest(result: NearbyResult) {
    router.push({ pathname: "/request-camera", params: { toWayId: result.wayId, toDisplayName: result.displayName } });
  }

  async function openMessage(result: NearbyResult) {
    if (!activeProfile) return;
    const conversation = await startConversation(activeProfile.id, result.id);
    router.push(`/messages/${conversation.id}`);
  }

  const showRadius = mode === "nearby" || mode === "address" || mode === "location";

  return (
    <View style={styles.container}>
      <SkyOceanBackground tone="pale" />
      <View style={[styles.header, { paddingTop: spacing.lg + insets.top }]}>
        <View>
          <Text style={styles.headerTitle}>WAY</Text>
          <Text style={styles.headerSubtitle}>{activeProfile ? activeProfile.wayId : ""}</Text>
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

      <View style={styles.resultKindRow}>
        <Pressable
          style={[styles.resultKindPill, resultKind === "profiles" && styles.resultKindPillActive]}
          onPress={() => setResultKind("profiles")}
        >
          <Text style={[styles.resultKindLabel, resultKind === "profiles" && styles.resultKindLabelActive]}>Profiles</Text>
        </Pressable>
        <Pressable
          style={[styles.resultKindPill, resultKind === "events" && styles.resultKindPillActive]}
          onPress={() => setResultKind("events")}
        >
          <Text style={[styles.resultKindLabel, resultKind === "events" && styles.resultKindLabelActive]}>Events</Text>
        </Pressable>
      </View>

      {resultKind === "events" && <EventSearchPanel />}

      {resultKind === "profiles" && (
      <>
      <View style={styles.controls}>
        <View style={styles.inputWrap}>
          {/* A resolved street address also starts with a digit (house
              number), which would otherwise false-positive this phone/WAY-ID
              heuristic — suppressed once the box is showing an
              address/location result rather than someone actively typing. */}
          {looksLikePhone(query) && mode !== "address" && mode !== "location" ? (
            <>
              <CountryCodeTrigger value={wayIdCountry} onPress={() => setCountryPickerOpen(true)} />
              <CountryCodeDivider />
            </>
          ) : (
            <Ionicons name="sparkles-outline" size={18} color={colors.textSecondary} />
          )}
          <TextInput
            style={styles.input}
            placeholder="Try 'hair stylist in Maitama Abuja' or '@wayid'"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setAddressCoords(null);
              setLocationCoords(null);
            }}
            onSubmitEditing={handleQuerySearch}
            returnKeyType="search"
          />
          {loading ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Pressable onPress={handleQuerySearch} hitSlop={8} accessibilityLabel="Search">
              <Ionicons name="arrow-forward-circle" size={22} color={colors.primary} />
            </Pressable>
          )}
          <Pressable onPress={() => setAddressSheetOpen(true)} hitSlop={8} accessibilityLabel="Search by address">
            <Ionicons name="home-outline" size={20} color={colors.textSecondary} />
          </Pressable>
          <Pressable onPress={() => setMapPickerOpen(true)} hitSlop={8} accessibilityLabel="Pick on map">
            <Ionicons name="map-outline" size={20} color={colors.textSecondary} />
          </Pressable>
          <Pressable onPress={() => router.push("/scan")} hitSlop={8} accessibilityLabel="Scan QR">
            <Ionicons name="qr-code-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
        {queryCategorySuggestions.length > 0 && (
          <View style={styles.querySuggestWrap}>
            {queryCategorySuggestions.map((name) => (
              <Pressable key={name} style={styles.querySuggestRow} onPress={() => setQuery(name)}>
                <Ionicons name="pricetag-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.querySuggestText}>{name}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <CountryPickerSheet
          open={countryPickerOpen}
          onClose={() => setCountryPickerOpen(false)}
          onSelect={(c) => {
            setWayIdCountry(c);
            setCountryPickerOpen(false);
          }}
        />

        <View style={styles.quickCategoryRow}>
          {QUICK_CATEGORIES.map((name) => (
            <Pressable
              key={name}
              style={[styles.categoryChip, category === name && styles.categoryChipActive]}
              onPress={() => searchNearbyWith({ category: name })}
            >
              <Text style={[styles.categoryChipText, category === name && styles.categoryChipTextActive]}>{name}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.categoryChip} onPress={() => setCategoryPickerOpen(true)}>
            <Text style={styles.categoryChipText}>More…</Text>
          </Pressable>
        </View>
        <CategoryPickerSheet
          open={categoryPickerOpen}
          onClose={() => setCategoryPickerOpen(false)}
          onSelect={(name) => {
            setCategoryPickerOpen(false);
            searchNearbyWith({ category: name || undefined });
          }}
          onDescribe={(text) => {
            setCategoryPickerOpen(false);
            searchNearbyWith({ describe: text });
          }}
        />

        {(category || describeText) && (
          <Pressable style={styles.activeFilterChip} onPress={() => searchNearbyWith({})}>
            <Ionicons name="close-circle" size={16} color={colors.primaryDark} />
            <Text style={styles.activeFilterText} numberOfLines={1}>
              {`Filtering: ${category || describeText}`}
            </Text>
          </Pressable>
        )}

        {mode !== "all" && <ViewToggle value={view} onChange={setView} />}
      </View>

      {(loading || locating) && <ActivityIndicator style={styles.spinner} color={colors.primaryDark} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && mode !== "all" && results.length === 0 && (
        <Text style={styles.empty}>No connections found in this radius yet.</Text>
      )}

      {showRadius && (
        <View style={styles.radiusWrap}>
          <Text style={styles.radiusLabel}>Search radius</Text>
          <RadiusPicker value={radiusMeters} onChange={handleRadiusChange} />
        </View>
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
      </>
      )}

      <MiniProfileModal
        result={selected}
        onClose={() => setSelected(null)}
        onSendRequest={openRequest}
        onRequestCamera={openCameraRequest}
        onMessage={openMessage}
        onViewProfile={openViewProfile}
        onOpenProfile={setSelected}
      />

      <MapPickerModal
        open={mapPickerOpen}
        initialCenter={coords}
        language={language}
        onClose={() => setMapPickerOpen(false)}
        onConfirm={pickOnMap}
      />

      <AddressSearchSheet
        open={addressSheetOpen}
        language={language}
        onClose={() => setAddressSheetOpen(false)}
        onSubmit={handleAddressResolved}
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
  resultKindRow: { flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  resultKindPill: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
  },
  resultKindPillActive: { backgroundColor: colors.primary },
  resultKindLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: "700" },
  resultKindLabelActive: { color: colors.textOnPrimary },
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
  querySuggestWrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  querySuggestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  querySuggestText: { ...typography.body, color: colors.textPrimary },
  quickCategoryRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  categoryChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryChipText: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  categoryChipTextActive: { color: colors.textOnPrimary },
  activeFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  activeFilterText: { ...typography.caption, color: colors.primaryDark, fontWeight: "600" },
  spinner: { marginTop: spacing.md },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.sm, ...typography.caption },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.md, ...typography.body },
  radiusWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  radiusLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: "700", marginBottom: 2 },
  resultsArea: { flex: 1, marginTop: spacing.sm },
  radarWrap: { alignItems: "center", justifyContent: "center", flex: 1, paddingBottom: 110 },
});
