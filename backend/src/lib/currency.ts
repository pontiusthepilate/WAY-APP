// Currencies the wallet accepts. NGN-only — Termii rejected our Sender ID
// request because the site showed multiple currencies (USD/EUR/GBP) on a
// wallet, which reads as international operation; this is now Naira-only.
// All amounts are minor units (kobo).
export const ALLOWED_CURRENCIES = ["NGN"] as const;
export type Currency = (typeof ALLOWED_CURRENCIES)[number];

export function isAllowedCurrency(value: string): value is Currency {
  return (ALLOWED_CURRENCIES as readonly string[]).includes(value);
}
