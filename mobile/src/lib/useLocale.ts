// The searcher's language, as a BCP-47 subtag (e.g. "fr", "ja") — passed
// into Mapbox calls so suggestions/results come back in the user's own
// language rather than always English. Uses the JS engine's own Intl
// support rather than adding a new native dependency; if that ever proves
// unreliable on-device, expo-localization's getLocales() is the fallback
// (and likely wanted anyway once the app has real UI translation).
export function useSearchLanguage(): string | undefined {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return locale?.split("-")[0] || undefined;
  } catch {
    return undefined;
  }
}
