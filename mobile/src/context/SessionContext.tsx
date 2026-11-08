import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getToken, setToken as persistToken } from "../api/client";
import { myProfiles } from "../api/profiles";
import type { Profile } from "../types";

interface SessionState {
  isLoading: boolean;
  isSignedIn: boolean;
  profiles: Profile[];
  activeProfile: Profile | null;
  setActiveProfileId: (id: string) => void;
  refreshProfiles: () => Promise<void>;
  onSignedIn: (profiles: Profile[]) => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | undefined>(undefined);

// The backend already orders primary-first, so list[0] is normally correct
// on its own — this is just a belt-and-suspenders explicit check against
// that ordering assumption drifting later.
function defaultProfileId(list: Profile[]): string | null {
  return list.find((p) => p.isPrimary)?.id ?? list[0]?.id ?? null;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          const fetched = await myProfiles();
          setProfiles(fetched);
          setActiveProfileId(defaultProfileId(fetched));
          setIsSignedIn(true);
        } catch {
          await persistToken(null);
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const refreshProfiles = useCallback(async () => {
    const fetched = await myProfiles();
    setProfiles(fetched);
    setActiveProfileId((current) => current ?? defaultProfileId(fetched));
  }, []);

  const onSignedIn = useCallback((newProfiles: Profile[]) => {
    setProfiles(newProfiles);
    setActiveProfileId(defaultProfileId(newProfiles));
    setIsSignedIn(true);
  }, []);

  const signOut = useCallback(async () => {
    await persistToken(null);
    setIsSignedIn(false);
    setProfiles([]);
    setActiveProfileId(null);
  }, []);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) ?? null,
    [profiles, activeProfileId]
  );

  return (
    <SessionContext.Provider
      value={{
        isLoading,
        isSignedIn,
        profiles,
        activeProfile,
        setActiveProfileId,
        refreshProfiles,
        onSignedIn,
        signOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
