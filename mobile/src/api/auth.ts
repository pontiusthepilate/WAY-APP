import { api, setToken } from "./client";
import type { Profile } from "../types";

export function requestOtp(identifier: string) {
  return api.post<{ sent: boolean; devCode?: string }>("/auth/request-otp", { identifier });
}

export async function verifyOtp(identifier: string, code: string) {
  const result = await api.post<{
    token: string;
    userId: string;
    isNewUser: boolean;
    freeProfileSlotsRemaining: number;
    profiles: Profile[];
  }>("/auth/verify-otp", { identifier, code });
  await setToken(result.token);
  return result;
}

export async function signOut() {
  await setToken(null);
}
