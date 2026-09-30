import type { Currency } from "../types";

const LOCALE_BY_CURRENCY: Record<Currency, string> = {
  USD: "en-US",
  NGN: "en-NG",
  EUR: "de-DE",
  GBP: "en-GB",
};

export function formatCurrency(amountMinor: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency] ?? "en-US", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

export function toMinorUnits(majorAmount: number): number {
  return Math.round(majorAmount * 100);
}
