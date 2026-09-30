import { Redirect } from "expo-router";
import { useSession } from "../context/SessionContext";

// Entry point: routes to the right place based on session state. Screens
// aren't hard-gated behind this (no auth guard on each route) — fine for
// this MVP where the only way in is through this flow.
export default function Index() {
  const { isSignedIn, activeProfile } = useSession();

  if (!isSignedIn) return <Redirect href="/welcome" />;
  if (!activeProfile) return <Redirect href="/create-profile" />;
  return <Redirect href="/feed" />;
}
