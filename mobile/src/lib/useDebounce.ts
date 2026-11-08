import { useEffect, useState } from "react";

// Returns `value`, but only after it's stopped changing for `delayMs` —
// the generic "wait for typing to pause" half of the debounced-fetch
// pattern already used in create-profile.tsx's WAY-ID availability check.
// Callers still own their own fetch effect (with their own stale-response
// guard), keyed off this debounced value, rather than this hook doing the
// fetching itself.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
