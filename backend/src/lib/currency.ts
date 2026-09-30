// Currencies the wallet accepts. All amounts are minor units (cents/kobo) —
// every one of these happens to use a 2-decimal minor unit, so no per-currency
// exponent table is needed yet. Add one if a 0- or 3-decimal currency joins.
export const ALLOWED_CURRENCIES = ["USD", "NGN", "EUR", "GBP"] as const;
export type Currency = (typeof ALLOWED_CURRENCIES)[number];

export function isAllowedCurrency(value: string): value is Currency {
  return (ALLOWED_CURRENCIES as readonly string[]).includes(value);
}
