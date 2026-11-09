import React, { useMemo, useState } from "react";
import { Alert, Modal, Pressable, SectionList, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { INTERESTS } from "../lib/interests";
import { matchCategories } from "../lib/categoryMatch";
import { suggestCategory } from "../api/categorySuggestions";
import { useSession } from "../context/SessionContext";

// Replaces a plain free-text "Category / interest" field with a tap
// target that opens CategoryPickerSheet, same split as
// CountryCodeTrigger/CountryPickerSheet — sits inside the caller's own
// input pill rather than rendering a border of its own.
export function CategoryTrigger({ value, onPress }: { value: string; onPress: () => void }) {
  return (
    <Pressable style={styles.trigger} onPress={onPress}>
      <Text style={value ? styles.triggerValue : styles.triggerPlaceholder} numberOfLines={1}>
        {value || "Category / interest (optional)"}
      </Text>
      <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (name: string) => void;
}

interface Section {
  title: string;
  data: string[];
}

const SECTIONS: Section[] = Object.values(
  INTERESTS.reduce<Record<string, Section>>((acc, item) => {
    (acc[item.group] ??= { title: item.group, data: [] }).data.push(item.name);
    return acc;
  }, {})
);

// Shown in place of the plain "no results" text once a search turns up
// nothing — lets the person submit what they typed as a new category
// suggestion instead of just hitting a dead end. Goes to the admin inbox
// (GET/POST /admin/category-suggestions); nothing here adds it to the live
// list automatically, see CategorySuggestion's schema comment.
function SuggestCategoryRow({ query }: { query: string }) {
  const { activeProfile } = useSession();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const trimmed = query.trim();

  if (!trimmed) return <Text style={styles.empty}>No categories match that search.</Text>;
  if (sent) return <Text style={styles.empty}>{`Thanks! "${trimmed}" was submitted for review.`}</Text>;

  async function handleSuggest() {
    if (!activeProfile) return;
    setSending(true);
    try {
      await suggestCategory(activeProfile.id, trimmed);
      setSent(true);
    } catch {
      Alert.alert("Couldn't send that", "Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.suggestWrap}>
      <Text style={styles.empty}>{`No categories match "${trimmed}".`}</Text>
      <Pressable style={styles.suggestButton} onPress={handleSuggest} disabled={sending || !activeProfile}>
        <Ionicons name="bulb-outline" size={16} color={colors.primary} />
        <Text style={styles.suggestButtonText}>{sending ? "Sending…" : `Suggest "${trimmed}" as a category`}</Text>
      </Pressable>
    </View>
  );
}

// The elaborate, grouped interest/category list search filters against —
// searchable across every group at once (matching CountryPickerSheet's
// search-while-browsing pattern), with a "Clear" row up top since this
// field is optional and a picker (unlike a text field) needs an explicit
// way to go back to "no category".
export function CategoryPickerSheet({ open, onClose, onSelect }: SheetProps) {
  const [query, setQuery] = useState("");

  const directSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.map((s) => ({ ...s, data: s.data.filter((name) => name.toLowerCase().includes(q)) })).filter(
      (s) => s.data.length > 0
    );
  }, [query]);

  // Falls back to keyword-matching a longer, sentence-style query ("I love
  // cooking and hiking on weekends") against the whole taxonomy once a
  // plain substring search on category names comes up empty — lets people
  // describe what they're after instead of having to already know the
  // exact tag name. Only kicks in for multi-word input so a single typo'd
  // word still falls through to the "suggest a new category" row below.
  const suggestedSections = useMemo(() => {
    if (directSections.length > 0) return [];
    if (query.trim().split(/\s+/).filter(Boolean).length < 2) return [];
    const matches = matchCategories(query);
    return matches.length > 0 ? [{ title: "Suggested for you", data: matches }] : [];
  }, [query, directSections]);

  const sections = directSections.length > 0 ? directSections : suggestedSections;

  function handleSelect(name: string) {
    onSelect(name);
    setQuery("");
  }

  function handleClose() {
    setQuery("");
    onClose();
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Choose a category / interest</Text>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search, or describe what you're looking for"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect
            multiline
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <Pressable style={styles.clearRow} onPress={() => handleSelect("")}>
          <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.clearText}>Clear category</Text>
        </Pressable>

        <SectionList
          sections={sections}
          keyExtractor={(name) => name}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => handleSelect(item)}>
              <Text style={styles.rowName}>{item}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<SuggestCategoryRow query={query} />}
        />
      </View>
    </Modal>
  );
}

interface MultiSheetProps {
  open: boolean;
  onClose: () => void;
  selected: string[];
  onToggle: (name: string) => void;
  max: number;
}

// Same grouped/searchable sheet as CategoryPickerSheet, but for a
// profile's own interests: taps toggle a checkmark instead of selecting
// and closing, since a profile holds a *set* of tags (Profile.categories)
// rather than the single filter value search's picker produces. Capped
// at `max` to match backend/src/routes/profiles.ts's zod limit.
export function CategoryPickerSheetMulti({ open, onClose, selected, onToggle, max }: MultiSheetProps) {
  const [query, setQuery] = useState("");

  const directSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.map((s) => ({ ...s, data: s.data.filter((name) => name.toLowerCase().includes(q)) })).filter(
      (s) => s.data.length > 0
    );
  }, [query]);

  // Same sentence-style fallback as CategoryPickerSheet — see its comment.
  const suggestedSections = useMemo(() => {
    if (directSections.length > 0) return [];
    if (query.trim().split(/\s+/).filter(Boolean).length < 2) return [];
    const matches = matchCategories(query);
    return matches.length > 0 ? [{ title: "Suggested for you", data: matches }] : [];
  }, [query, directSections]);

  const sections = directSections.length > 0 ? directSections : suggestedSections;

  const atMax = selected.length >= max;

  function handleClose() {
    setQuery("");
    onClose();
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Choose your interests</Text>
        <Text style={styles.counter}>{selected.length}/{max} selected</Text>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search, or describe what you're into"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect
            multiline
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(name) => name}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const isSelected = selected.includes(item);
            const disabled = !isSelected && atMax;
            return (
              <Pressable
                style={[styles.row, styles.multiRow]}
                onPress={() => onToggle(item)}
                disabled={disabled}
              >
                <Text style={[styles.rowName, disabled && styles.rowNameDisabled]}>{item}</Text>
                {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </Pressable>
            );
          }}
          ListEmptyComponent={<SuggestCategoryRow query={query} />}
        />

        <Pressable style={styles.doneButton} onPress={handleClose}>
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// A row of removable chips for the interests a profile has already
// picked — sits above the CategoryPickerSheetMulti trigger on
// edit-profile so the current selection is visible without opening
// the sheet.
export function SelectedCategoryChips({ items, onRemove }: { items: string[]; onRemove: (name: string) => void }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.chipRow}>
      {items.map((name) => (
        <Pressable key={name} style={styles.chip} onPress={() => onRemove(name)}>
          <Text style={styles.chipText}>{name}</Text>
          <Ionicons name="close" size={14} color={colors.textOnPrimary} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs },
  triggerValue: { ...typography.body, color: colors.textPrimary, flex: 1 },
  triggerPlaceholder: { ...typography.body, color: colors.textSecondary, flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(20,40,30,0.35)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    height: "80%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  title: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md },
  counter: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchIcon: { marginRight: spacing.xs },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  clearRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  clearText: { ...typography.body, color: colors.textSecondary, fontWeight: "600" },
  list: { flex: 1 },
  sectionHeader: { backgroundColor: colors.surface, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  sectionHeaderText: { ...typography.caption, color: colors.primaryDark, fontWeight: "700", textTransform: "uppercase" },
  row: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowName: { ...typography.body, color: colors.textPrimary },
  rowNameDisabled: { color: colors.textSecondary },
  multiRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
  suggestWrap: { alignItems: "center", marginTop: spacing.xl, gap: spacing.sm },
  suggestButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  suggestButtonText: { ...typography.body, color: colors.primary, fontWeight: "600" },
  doneButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  doneButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs / 2,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs / 2 + 2,
    paddingHorizontal: spacing.sm,
  },
  chipText: { ...typography.caption, color: colors.textOnPrimary, fontWeight: "600" },
});
