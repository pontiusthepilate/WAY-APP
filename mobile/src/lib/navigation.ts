import { router } from "expo-router";

// router.back() throws "GO_BACK was not handled" when there's no history to
// pop — notably when a screen is reached via a cold-start push notification
// deep link (e.g. tapping "X is live now" when the app wasn't already
// running), which makes that screen the first and only stack entry. Falls
// back to a sensible route instead of leaving the user stuck.
export function safeBack(fallback: "/feed" | "/wallet" = "/feed") {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
