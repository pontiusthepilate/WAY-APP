import React, { useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../theme/theme";

// A global "dismiss keyboard" button — shows up whenever ANY keyboard is on
// screen (alphabet or numeric/decimal-pad alike), not wired per-screen.
// Numeric/decimal-pad keyboards in particular have no built-in Done key on
// iOS, so without this there's no way to close them short of tapping
// somewhere else first — which doesn't help when the keyboard is covering
// the exact button someone needs to reach. Mounted once at the root (see
// app/_layout.tsx), same "one small global overlay, not a per-screen fix"
// shape as GlobalNavPanel.
export function KeyboardDismissButton() {
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // *Will* fires before the keyboard finishes animating in/out on iOS,
    // so this button appears/disappears in sync with the keyboard instead
    // of lagging a beat behind it; Android only has the *Did* variants.
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (!visible) return null;

  return (
    <Pressable
      style={[styles.button, { top: insets.top + spacing.sm }]}
      onPress={() => Keyboard.dismiss()}
      hitSlop={10}
      accessibilityLabel="Dismiss keyboard"
    >
      <Ionicons name="chevron-down-circle" size={34} color={colors.primaryDark} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: spacing.lg,
    zIndex: 50,
    elevation: 50,
    backgroundColor: colors.surface,
    borderRadius: 17,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
