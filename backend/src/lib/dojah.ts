// Real CAC (business registration) lookup via Dojah's KYB API — the
// primary data source for business-profile verification (see
// routes/businessVerification.ts). lib/cacLookup.ts is the fallback used
// while this account's compliance review is pending, or if this ever
// fails. Same role either way: gives a human reviewer real registry data
// to decide with — this never auto-verifies anyone on its own.
const DOJAH_BASE_URL = process.env.DOJAH_LIVE === "1" ? "https://api.dojah.io" : "https://sandbox.dojah.io";

export const DOJAH_COMPANY_TYPES = [
  "BUSINESS_NAME",
  "COMPANY",
  "INCORPORATED_TRUSTEES",
  "LIMITED_PARTNERSHIP",
  "LIMITED_LIABILITY_PARTNERSHIP",
] as const;
export type DojahCompanyType = (typeof DOJAH_COMPANY_TYPES)[number];

export function isDojahConfigured(): boolean {
  return !!(process.env.DOJAH_APP_ID && process.env.DOJAH_SECRET_KEY);
}

export interface DojahCacResult {
  companyName: string;
  rcNumber: string;
  typeOfCompany: string;
  status: string;
  state: string | null;
  city: string | null;
  lga: string | null;
}

interface DojahCacResponse {
  entity?: {
    company_name?: string;
    rc_number?: string;
    type_of_company?: string;
    status?: string;
    state?: string;
    city?: string;
    lga?: string;
  };
}

// Returns null when unconfigured, or when Dojah has no record for this
// exact (rcNumber, companyType) pair — callers should treat that the same
// as "couldn't confirm", not "not registered".
export async function lookupCacViaDojah(
  rcNumber: string,
  companyType: DojahCompanyType
): Promise<DojahCacResult | null> {
  if (!isDojahConfigured()) {
    console.warn("[WAY][dojah] not configured — skipping");
    return null;
  }

  const params = new URLSearchParams({ rc_number: rcNumber, company_type: companyType });
  const res = await fetch(`${DOJAH_BASE_URL}/api/v1/kyc/cac/basic?${params}`, {
    headers: {
      // Dojah's own secret key, sent as-is — not a "Bearer" token.
      Authorization: process.env.DOJAH_SECRET_KEY!,
      AppId: process.env.DOJAH_APP_ID!,
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Dojah CAC lookup failed (${res.status}): ${await res.text()}`);
  }

  const body = (await res.json()) as DojahCacResponse;
  const entity = body.entity;
  if (!entity?.company_name) return null;

  return {
    companyName: entity.company_name,
    rcNumber: entity.rc_number ?? rcNumber,
    typeOfCompany: entity.type_of_company ?? companyType,
    status: entity.status ?? "UNKNOWN",
    state: entity.state ?? null,
    city: entity.city ?? null,
    lga: entity.lga ?? null,
  };
}
