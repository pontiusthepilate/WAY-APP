import { api } from "./client";
import type { Currency, Transaction, WalletBalance } from "../types";

function qs(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export function getWallet(profileId: string) {
  return api.get<{ walletId: string; balances: WalletBalance[] }>(`/wallet${qs({ profileId })}`);
}

export type FundResult =
  | { status: "completed"; balance: WalletBalance; transaction: Transaction }
  | { status: "requires_action"; authorizationUrl: string; reference: string };

export function fundWallet(input: { profileId: string; currency: Currency; amount: number; method: "card" | "crypto" }) {
  return api.post<FundResult>("/wallet/fund", input);
}

export function verifyFunding(input: { profileId: string; reference: string }) {
  return api.post<{ status: "completed"; balance: WalletBalance } | { status: "failed"; error: string }>(
    "/wallet/fund/verify",
    input
  );
}

export function transferFunds(input: { fromProfileId: string; toWayId: string; currency: Currency; amount: number; note?: string }) {
  return api.post<Transaction>("/wallet/transfer", input);
}

export function getTransactions(input: {
  profileId: string;
  cursor?: string;
  limit?: number;
  withProfileId?: string;
  withWayId?: string;
}) {
  return api.get<{ transactions: Transaction[]; nextCursor: string | null }>(`/wallet/transactions${qs(input)}`);
}
