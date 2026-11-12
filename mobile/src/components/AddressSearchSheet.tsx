import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { newSessionToken, retrievePlace, suggestPlaces, type PlaceSuggestion } from "../api/mapbox";
import { PlaceSuggestions } from "./PlaceSuggestions";
import { useDebouncedValue } from "../lib/useDebounce";

interface Props {
  open: boolean;
  language?: string;
  onClose: () => void;
  // Either a precisely-resolved point (from a tapped suggestion) or just the
  // raw text (submitted without picking one) — the caller's own backend
  // geocodeAddress call handles the latter as a one-shot fallback, exactly
  // like free-typed address text already did before this sheet existed.
  onSubmit: (result: { label: string; lat?: number; lng?: number }) => void;
}

// A dedicated, single-purpose address field — unlike the main search box,
// live suggestions here are the whole point (opening this sheet is already
// a deliberate "I want to search by exact address" action, not incidental
// typing), so it's the one place in this screen that still talks to
// Mapbox's Search Box API on every keystroke.
export function AddressSearchSheet({ open, language, onClose, onSubmit }: Props) {
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const sessionRef = useRef(newSessionToken());
  const debouncedText = useDebouncedValue(text, 300);

  // Resets to a blank field (and a fresh billing session) every time the
  // sheet opens, same "no stale state from last time" convention
  // MapPickerModal/CountryPickerSheet already use.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText("");
      setSuggestions([]);
      sessionRef.current = newSessionToken();
    }
  }, [open]);

  useEffect(() => {
    const q = debouncedText.trim();
    if (!open || q.length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    suggestPlaces(q, { sessionToken: sessionRef.current, language, types: "address,street" })
      .then((results) => {
        if (!cancelled) setSuggestions(results);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedText, open, language]);

  async function handleSelect(s: PlaceSuggestion) {
    const resolved = await retrievePlace(s.mapboxId, { sessionToken: sessionRef.current, language });
    sessionRef.current = newSessionToken();
    if (!resolved) return;
    onSubmit({ label: resolved.label, lat: resolved.lat, lng: resolved.lng });
  }

  function handleSubmitText() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit({ label: trimmed });
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Search by address</Text>
        <Text style={styles.subtitle}>Type a street address — pick a match, or search the text as typed.</Text>

        <View style={styles.inputWrap}>
          <Ionicons name="home-outline" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="e.g. 12 Allen Avenue, Ikeja"
            placeholderTextColor={colors.textSecondary}
            autoFocus
            value={text}
            onChangeText={setText}
            onSubmitEditing={handleSubmitText}
            returnKeyType="search"
          />
          {loading && <ActivityIndicator size="small" color={colors.textSecondary} />}
        </View>

        <PlaceSuggestions suggestions={suggestions} loading={loading} onSelect={handleSelect} />

        <Pressable style={styles.searchButton} onPress={handleSubmitText}>
          <Text style={styles.searchButtonText}>Search this address</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(20,40,30,0.35)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  title: { ...typography.h3, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, paddingVertical: spacing.sm, ...typography.body, color: colors.textPrimary },
  searchButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  searchButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
});
