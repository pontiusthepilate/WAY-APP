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
          setActiveProfileId(fetched[0]?.id ?? null);
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
    setActiveProfileId((current) => current ?? fetched[0]?.id ?? null);
  }, []);

  const onSignedIn = useCallback((newProfiles: Profile[]) => {
    setProfiles(newProfiles);
    setActiveProfileId(newProfiles[0]?.id ?? null);
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
