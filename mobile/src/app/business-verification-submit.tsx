import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { PageBackgroundVideo } from "../components/PageBackgroundVideo";
import { useSession } from "../context/SessionContext";
import { submitBusinessVerification, COMPANY_TYPES, type CompanyType } from "../api/businessVerification";
import { uploadMedia } from "../api/uploads";
import { ApiError } from "../api/client";
import { safeBack } from "../lib/navigation";

const COMPANY_TYPE_LABEL: Record<CompanyType, string> = {
  BUSINESS_NAME: "Business Name",
  COMPANY: "Company",
  INCORPORATED_TRUSTEES: "Incorporated Trustees",
  LIMITED_PARTNERSHIP: "Limited Partnership",
  LIMITED_LIABILITY_PARTNERSHIP: "Limited Liability Partnership",
};

export default function BusinessVerificationSubmitScreen() {
  const insets = useSafeAreaInsets();
  const { activeProfile } = useSession();
  const [rcNumber, setRcNumber] = useState("");
  const [companyType, setCompanyType] = useState<CompanyType | null>(null);
  const [documentUri, setDocumentUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePickDocument() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    setDocumentUri(result.assets[0].uri);
  }

  async function handleSubmit() {
    setError(null);
    if (!activeProfile) return;
    if (!rcNumber.trim()) return setError("Enter your CAC RC number");
    if (!companyType) return setError("Select your company type");
    if (!documentUri) return setError("Add a photo of your CAC certificate");

    setSubmitting(true);
    try {
      setUploading(true);
      const uploaded = await uploadMedia({ uri: documentUri, type: "image" });
      setUploading(false);

      await submitBusinessVerification({
        profileId: activeProfile.id,
        rcNumber: rcNumber.trim(),
        companyType,
        documentUrls: [uploaded.url],
      });
      safeBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setUploading(false);
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <PageBackgroundVideo />
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Verify your business</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Text style={styles.label}>CAC RC number</Text>
        <TextInput
          style={styles.input}
          value={rcNumber}
          onChangeText={setRcNumber}
          placeholder="e.g. RC 1234567"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Company type</Text>
        <View style={styles.typeGrid}>
          {COMPANY_TYPES.map((t) => (
            <Pressable
              key={t}
              style={[styles.typeChip, companyType === t && styles.typeChipActive]}
              onPress={() => setCompanyType(t)}
            >
              <Text style={[styles.typeChipText, companyType === t && styles.typeChipTextActive]}>
                {COMPANY_TYPE_LABEL[t]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>CAC certificate</Text>
        <Pressable style={styles.documentPicker} onPress={handlePickDocument}>
          {documentUri ? (
            <Image source={{ uri: documentUri }} style={styles.documentPreview} />
          ) : (
            <>
              <Ionicons name="document-attach-outline" size={28} color={colors.textSecondary} />
              <Text style={styles.documentPickerText}>Add a photo of your certificate</Text>
            </>
          )}
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.submitButtonText}>{uploading ? "Uploading…" : "Submit for review"}</Text>
          )}
        </Pressable>
        <Text style={styles.hint}>
          A human reviews every submission — we aim to respond within 7 days.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: spacing.lg },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  label: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  typeChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { ...typography.caption, color: colors.textPrimary, fontWeight: "600" },
  typeChipTextActive: { color: colors.textOnPrimary },
  documentPicker: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: spacing.xs,
    overflow: "hidden",
  },
  documentPickerText: { ...typography.caption, color: colors.textSecondary },
  documentPreview: { width: "100%", height: 180 },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.md },
  submitButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  hint: { ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm },
});
