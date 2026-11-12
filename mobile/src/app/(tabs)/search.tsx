import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { FIND_MODES, SearchModeTabs } from "../../components/SearchModeTabs";
import { RadiusPicker } from "../../components/RadiusPicker";
import { MiniProfileModal } from "../../components/MiniProfileModal";
import { EventSearchPanel } from "../../components/EventSearchPanel";
import { SkyOceanBackground } from "../../components/SkyOceanBackground";
import { DotOutline } from "../../components/DotOutline";
import { CountryCodeDivider, CountryCodeTrigger, CountryPickerSheet } from "../../components/CountryCodePicker";
import { CategoryPickerSheet, CategoryTrigger } from "../../components/CategoryPicker";
import { useSession } from "../../context/SessionContext";
import { useDeviceLocation } from "../../lib/useDeviceLocation";
import { DEFAULT_COUNTRY, type Country } from "../../lib/countries";
import { parseSearchQuery, searchAddress, searchAll, searchByWayId, searchLocation, searchNearby } from "../../api/search";
import { newSessionToken, retrievePlace, suggestPlaces, type PlaceSuggestion } from "../../api/mapbox";
import { PlaceSuggestions } from "../../components/PlaceSuggestions";
import { MapPickerModal } from "../../components/MapPickerModal";
import { useDebouncedValue } from "../../lib/useDebounce";
import { useSearchLanguage } from "../../lib/useLocale";
import { startConversation } from "../../api/messages";
import { updateVisibility } from "../../api/profiles";
import { getActiveStatusIds } from "../../api/status";
import { getHasSeenAccessGrantNudge, markAccessGrantNudgeSeen } from "../../lib/accessGrantNudge";
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

  const [resultKind, setResultKind] = useState<"profiles" | "events">("profiles");
  const [mode, setMode] = useState<SearchMode>("nearby");
  const [view, setView] = useState<ResultView>("radar");
  const [radiusMeters, setRadiusMeters] = useState(500);
  const [category, setCategory] = useState("");
  // Address/Location/WAY ID are one merged field in the UI (`findText`) —
  // these three still hold whichever one actually got resolved, since
  // runSearch's own per-mode branches below are unchanged and still read
  // from them directly (same for `discoveredVia`, which still needs the
  // real resolved mode, not just "find").
  const [addressText, setAddressText] = useState("");
  const [locationText, setLocationText] = useState("");
  const [wayIdText, setWayIdText] = useState("");
  const [wayIdCountry, setWayIdCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [allQueryText, setAllQueryText] = useState("");
  const [nlQuery, setNlQuery] = useState("");
  const [unifiedResults, setUnifiedResults] = useState<UnifiedSearchResults | null>(null);
  const language = useSearchLanguage();

  // Resolved coordinates from a tapped Mapbox suggestion — cleared whenever
  // the field's text is hand-edited, so runSearch knows whether to reuse
  // this point directly or fall back to a fresh free-text geocode.
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [findText, setFindText] = useState("");
  const [findSuggestions, setFindSuggestions] = useState<PlaceSuggestion[]>([]);
  const [findSuggestLoading, setFindSuggestLoading] = useState(false);
  const findSessionRef = useRef(newSessionToken());
  const debouncedFindText = useDebouncedValue(findText, 300);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

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

  useEffect(() => {
    const text = debouncedFindText.trim();
    // A phone-like query isn't a place — skip the (wasted) Mapbox call and
    // just clear any suggestions left over from typing something else first.
    if (text.length < 3 || looksLikePhone(text)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFindSuggestions([]);
      return;
    }
    let cancelled = false;
    setFindSuggestLoading(true);
    suggestPlaces(text, { sessionToken: findSessionRef.current, language })
      .then((results) => {
        if (!cancelled) setFindSuggestions(results);
      })
      .finally(() => {
        if (!cancelled) setFindSuggestLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedFindText, language]);

  // Accepts an optional category override so a fresh pick from the
  // category sheet (direct, sentence-matched, or "Clear") can run the
  // search immediately instead of waiting for `category` state to
  // re-render — picking a category then has to feel like it "just runs
  // the search", not require a separate tap on the Search button.
  // describeOverride is the free-text "search people matching this
  // description" variant from the same sheet. Every call site wraps this
  // in an arrow function (never passed directly as a callback prop), so
  // no event-object guard is needed here.
  const runSearch = useCallback(async (categoryOverride?: string, describeOverride?: string) => {
    if (!activeProfile) return;
    const cat = categoryOverride ?? category;
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
          radiusMeters,
          category: cat || undefined,
          describe: describeOverride,
          ...point,
        });
      } else if (mode === "address") {
        if (!addressText.trim()) {
          setError("Enter a street address to search.");
          return;
        }
        next = await searchAddress({
          profileId: activeProfile.id,
          ...(addressCoords ?? { address: addressText.trim() }),
          radiusMeters,
          category: cat || undefined,
          describe: describeOverride,
          language,
        });
      } else if (mode === "location") {
        if (!locationText.trim()) {
          setError("Enter a place, city, state, or country to search.");
          return;
        }
        next = await searchLocation({
          profileId: activeProfile.id,
          ...(locationCoords ?? { query: locationText.trim() }),
          radiusMeters,
          category: cat || undefined,
          describe: describeOverride,
          language,
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
        const unified = await searchAll({ profileId: activeProfile.id, query: trimmed, language });
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
  }, [
    activeProfile,
    mode,
    coords,
    radiusMeters,
    category,
    addressText,
    addressCoords,
    locationText,
    locationCoords,
    wayIdText,
    wayIdCountry,
    allQueryText,
    language,
    refreshDeviceLocation,
  ]);

  useEffect(() => {
    // Runs the search in response to the device location or mode changing;
    // that's the "external system" this effect synchronizes with.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (mode === "nearby" && coords) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, mode]);

  // Natural-language search: parses nlQuery into the same structured
  // fields the manual controls below produce (lib/searchIntent.ts on the
  // backend), then searches with those values directly — mirrors
  // jumpToLocation/selectAddressSuggestion below, which also call the
  // search*/searchAll API functions directly with freshly-resolved values
  // rather than through runSearch, since setMode/setAddressText etc.
  // wouldn't have flowed through a render yet for runSearch's closure to see.
  async function handleNaturalLanguageSearch() {
    const trimmed = nlQuery.trim();
    if (!trimmed || !activeProfile) return;
    setLoading(true);
    setError(null);
    try {
      const parsed = await parseSearchQuery(trimmed);
      setMode(parsed.mode);
      setCategory("");
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
        if (!parsed.locationQuery) {
          setError("Enter a street address to search.");
          return;
        }
        setFindText(parsed.locationQuery);
        setAddressText(parsed.locationQuery);
        setAddressCoords(null);
        next = await searchAddress({ profileId: activeProfile.id, address: parsed.locationQuery, radiusMeters: radius, describe: parsed.describe ?? undefined, language });
      } else if (parsed.mode === "location") {
        if (!parsed.locationQuery) {
          setError("Enter a place, city, state, or country to search.");
          return;
        }
        setFindText(parsed.locationQuery);
        setLocationText(parsed.locationQuery);
        setLocationCoords(null);
        next = await searchLocation({ profileId: activeProfile.id, query: parsed.locationQuery, radiusMeters: radius, describe: parsed.describe ?? undefined, language });
      } else if (parsed.mode === "wayid") {
        const q = parsed.wayIdQuery ?? trimmed;
        setFindText(q);
        setWayIdText(q);
        next = await searchByWayId({ profileId: activeProfile.id, query: q });
        if (next.length === 0) setError("No WAY found with that ID or phone number.");
      } else {
        const q = parsed.allQuery ?? trimmed;
        setAllQueryText(q);
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
    setFindText(loc.label);
    setLocationText(loc.label);
    setLoading(true);
    setError(null);
    try {
      const next = await searchLocation({ profileId: activeProfile.id, lat: loc.lat, lng: loc.lng, radiusMeters, category: category || undefined, language });
      setResults(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // Resolves a tapped suggestion to a point and searches on it directly —
  // mirrors jumpToLocation's "we already have coordinates, don't re-geocode"
  // shape, rather than routing through runSearch (whose addressText/
  // locationCoords state wouldn't be updated yet by the time it'd run).
  // Address vs. location is decided from Mapbox's own feature_type on the
  // suggestion — "address"/"street" is a precise street-level result,
  // everything else (place/locality/region/country/poi/etc.) is a general
  // location — so this doesn't need a second classification step.
  async function selectFindSuggestion(s: PlaceSuggestion) {
    if (!activeProfile) return;
    const resolved = await retrievePlace(s.mapboxId, { sessionToken: findSessionRef.current, language });
    findSessionRef.current = newSessionToken();
    setFindSuggestions([]);
    if (!resolved) return;
    const resolvedMode: "address" | "location" = s.featureType === "address" || s.featureType === "street" ? "address" : "location";
    setMode(resolvedMode);
    setFindText(resolved.label);
    setLoading(true);
    setError(null);
    try {
      let next: NearbyResult[];
      if (resolvedMode === "address") {
        setAddressText(resolved.label);
        setAddressCoords({ lat: resolved.lat, lng: resolved.lng });
        next = await searchAddress({ profileId: activeProfile.id, lat: resolved.lat, lng: resolved.lng, radiusMeters, category: category || undefined, language });
      } else {
        setLocationText(resolved.label);
        setLocationCoords({ lat: resolved.lat, lng: resolved.lng });
        next = await searchLocation({ profileId: activeProfile.id, lat: resolved.lat, lng: resolved.lng, radiusMeters, category: category || undefined, language });
      }
      setResults(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // Submits the merged field's free text (no suggestion tapped) — a bare
  // WAY ID/phone number, or address/location text typed without picking an
  // autocomplete result. Reuses the same backend classifier the AI search
  // bar already calls (lib/searchIntent.ts); a "nearby"/"all" guess from it
  // doesn't apply to this field at all, so that falls back to "location" —
  // the single most forgiving guess, same reasoning parseSearchQuery's own
  // backend fallback already uses.
  async function handleFindSearch() {
    const trimmed = findText.trim();
    if (!trimmed || !activeProfile) return;
    setLoading(true);
    setError(null);
    try {
      const parsed = await parseSearchQuery(trimmed);
      const resolvedMode: "address" | "location" | "wayid" =
        parsed.mode === "address" || parsed.mode === "location" || parsed.mode === "wayid" ? parsed.mode : "location";
      setMode(resolvedMode);
      let next: NearbyResult[];
      if (resolvedMode === "wayid") {
        const q = parsed.wayIdQuery ?? trimmed;
        setWayIdText(q);
        const query = looksLikePhone(q) && !q.startsWith("+") ? `+${wayIdCountry.dialCode}${q.replace(/\D/g, "")}` : q;
        next = await searchByWayId({ profileId: activeProfile.id, query });
        if (next.length === 0) setError("No WAY found with that ID or phone number.");
      } else if (resolvedMode === "address") {
        const q = parsed.locationQuery ?? trimmed;
        setAddressText(q);
        setAddressCoords(null);
        next = await searchAddress({ profileId: activeProfile.id, address: q, radiusMeters, category: category || undefined, language });
      } else {
        const q = parsed.locationQuery ?? trimmed;
        setLocationText(q);
        setLocationCoords(null);
        next = await searchLocation({ profileId: activeProfile.id, query: q, radiusMeters, category: category || undefined, language });
      }
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
  // search on it directly" shape as selectFindSuggestion above).
  async function pickOnMap(point: { lat: number; lng: number; label: string }) {
    setMapPickerOpen(false);
    if (!activeProfile) return;
    setMode("location");
    setFindText(point.label);
    setLocationText(point.label);
    setLocationCoords({ lat: point.lat, lng: point.lng });
    setLoading(true);
    setError(null);
    try {
      const next = await searchLocation({ profileId: activeProfile.id, lat: point.lat, lng: point.lng, radiusMeters, category: category || undefined, language });
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
          <Ionicons name="sparkles-outline" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="Try 'bike mechanics near me' or '@wayid'"
            placeholderTextColor={colors.textSecondary}
            value={nlQuery}
            onChangeText={setNlQuery}
            onSubmitEditing={handleNaturalLanguageSearch}
            returnKeyType="search"
          />
          {loading ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Pressable onPress={handleNaturalLanguageSearch} hitSlop={8} accessibilityLabel="Search">
              <Ionicons name="arrow-forward-circle" size={22} color={colors.primary} />
            </Pressable>
          )}
        </View>

        <SearchModeTabs value={mode} onChange={setMode} />

        {FIND_MODES.includes(mode) && (
          <>
            <View style={styles.searchRow}>
              <View style={[styles.inputWrap, styles.findInputWrap]}>
                {looksLikePhone(findText) ? (
                  <>
                    <CountryCodeTrigger value={wayIdCountry} onPress={() => setCountryPickerOpen(true)} />
                    <CountryCodeDivider />
                  </>
                ) : (
                  <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
                )}
                <TextInput
                  style={styles.input}
                  placeholder="Address, place, or WAY ID / phone"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  value={findText}
                  onChangeText={(text) => {
                    setFindText(text);
                    setAddressCoords(null);
                    setLocationCoords(null);
                  }}
                  onSubmitEditing={handleFindSearch}
                />
                {loading ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : (
                  <Pressable onPress={handleFindSearch} hitSlop={8} accessibilityLabel="Search">
                    <Ionicons name="arrow-forward-circle" size={22} color={colors.primary} />
                  </Pressable>
                )}
                <Pressable onPress={() => setMapPickerOpen(true)} hitSlop={8} accessibilityLabel="Pick on map">
                  <Ionicons name="map-outline" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
              <Pressable style={styles.scanButton} onPress={() => router.push("/scan")} hitSlop={8}>
                <Ionicons name="qr-code-outline" size={22} color={colors.primaryDark} />
              </Pressable>
            </View>
            <PlaceSuggestions suggestions={findSuggestions} loading={findSuggestLoading} onSelect={selectFindSuggestion} />
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
        {mode === "all" && (
          <View style={styles.inputWrap}>
            <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Search people, businesses, podcasts…"
              placeholderTextColor={colors.textSecondary}
              value={allQueryText}
              onChangeText={setAllQueryText}
              onSubmitEditing={() => runSearch()}
            />
          </View>
        )}
        {mode !== "wayid" && mode !== "all" && (
          <>
            <View style={styles.inputWrap}>
              <Ionicons name="pricetag-outline" size={18} color={colors.textSecondary} />
              <CategoryTrigger value={category} onPress={() => setCategoryPickerOpen(true)} />
            </View>
            <CategoryPickerSheet
              open={categoryPickerOpen}
              onClose={() => setCategoryPickerOpen(false)}
              onSelect={(name) => {
                setCategory(name);
                setCategoryPickerOpen(false);
                runSearch(name);
              }}
              onDescribe={(text) => {
                setCategoryPickerOpen(false);
                runSearch(undefined, text);
              }}
            />
          </>
        )}

        {mode !== "wayid" && mode !== "all" && <RadiusPicker value={radiusMeters} onChange={setRadiusMeters} />}

        {mode === "all" && (
          <View style={styles.searchRow}>
            <DotOutline radius={radii.pill} tone="onDark" style={styles.searchButtonWrap}>
              <Pressable style={styles.searchButton} onPress={() => runSearch()}>
                <Text style={styles.searchButtonText}>Search</Text>
                <Ionicons name="search-outline" size={18} color={colors.textOnPrimary} />
              </Pressable>
            </DotOutline>
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
  // The merged Address/Location/WAY ID field sits next to the scan button
  // in its own row, so (unlike every other inputWrap here, which is the
  // sole thing in its row) it needs to be told to take the remaining space.
  findInputWrap: { flex: 1 },
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
  radarWrap: { alignItems: "center", justifyContent: "center", flex: 1, paddingBottom: 110 },
});
