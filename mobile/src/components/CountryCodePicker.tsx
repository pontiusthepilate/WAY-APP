import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { COUNTRIES, type Country } from "../lib/countries";

// The dial-code trigger — flag, code, chevron — with no border/background of
// its own, meant to sit directly inside a caller's input pill (divided from
// the text field by a thin line) rather than as its own separate chip next
// to it.
export function CountryCodeTrigger({ value, onPress }: { value: Country; onPress: () => void }) {
  return (
    <Pressable style={styles.trigger} onPress={onPress}>
      <Text style={styles.flag}>{value.flag}</Text>
      <Text style={styles.dialCode}>+{value.dialCode}</Text>
      <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
    </Pressable>
  );
}

// A thin vertical rule to separate the trigger from the text field it sits
// beside inside the same pill.
export function CountryCodeDivider() {
  return <View style={styles.divider} />;
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (country: Country) => void;
}

// The searchable country sheet itself — Nigeria sits first in the list (and
// is the default selection elsewhere) since it's the app's home market.
export function CountryPickerSheet({ open, onClose, onSelect }: SheetProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    const qDigits = q.replace(/^\+/, "");
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.dialCode.startsWith(qDigits));
  }, [query]);

  function handleSelect(country: Country) {
    onSelect(country);
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
        <Text style={styles.title}>Choose a country</Text>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search country or code"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <FlatList
          data={results}
          keyExtractor={(c) => c.iso2}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => handleSelect(item)}>
              <Text style={styles.rowFlag}>{item.flag}</Text>
              <Text style={styles.rowName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.rowDialCode}>+{item.dialCode}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No countries match that search.</Text>}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: "row", alignItems: "center", gap: 4 },
  flag: { fontSize: 18 },
  dialCode: { ...typography.body, color: colors.textPrimary, fontWeight: "600" },
  divider: { width: 1, alignSelf: "stretch", marginVertical: spacing.xs, backgroundColor: colors.border },
  backdrop: { flex: 1, backgroundColor: "rgba(20,40,30,0.35)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    height: "75%",
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
  list: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowFlag: { fontSize: 22 },
  rowName: { ...typography.body, color: colors.textPrimary, flex: 1 },
  rowDialCode: { ...typography.body, color: colors.textSecondary, fontWeight: "600" },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
