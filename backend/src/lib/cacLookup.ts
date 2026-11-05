// Interim CAC (Corporate Affairs Commission, Nigeria) registration lookup
// via a third-party Apify Actor that scrapes CAC's own public register.
// Fallback for lib/dojah.ts: used while a Dojah compliance review is
// pending, or if Dojah is ever unavailable — same "real data to inform a
// human's decision, never auto-verify" role, just a different data source.
// Not official or endorsed by CAC — this is one Actor's best-effort scrape
// of the public register, so treat a lookup failure as "couldn't confirm",
// not "not registered".
const APIFY_ACTOR = "regdata/nigeria-cac-company-scraper";
const APIFY_BASE_URL = "https://api.apify.com/v2";
// $9 / 1,000 searches at the time this was wired up — a single lookup here
// costs a fraction of a cent, so this cap is just a sanity ceiling against a
// runaway call, not a real budget constraint.
const MAX_CHARGE_USD = "0.05";

export function isCacScraperConfigured(): boolean {
  return !!process.env.APIFY_API_TOKEN;
}

export interface CacLookupResult {
  companyName: string;
  rcNumber: string;
  registrationNumberFormatted: string;
  classification: string;
  classificationLabel: string;
  status: string;
  registrationDate: string | null;
  source: string;
  sourceUrl: string;
}

interface ApifyDatasetItem {
  approvedName?: string;
  rcNumber?: string;
  registrationNumberFormatted?: string;
  classification?: string;
  classificationLabel?: string;
  status?: string;
  registrationDate?: string | null;
  nameMatch?: string;
  source?: string;
  sourceUrl?: string;
}

// Looks up a single RC/BN/IT number against CAC's public register. Returns
// null when unconfigured or when the register has nothing under that exact
// number — callers should treat null the same as "couldn't confirm",
// and still let a human reviewer decide, never auto-reject on it.
export async function lookupCacRegistration(registrationNumber: string): Promise<CacLookupResult | null> {
  if (!isCacScraperConfigured()) {
    console.warn("[WAY][cac-lookup] not configured — skipping");
    return null;
  }

  const res = await fetch(
    `${APIFY_BASE_URL}/actors/${APIFY_ACTOR}/run-sync-get-dataset-items?maxTotalChargeUsd=${MAX_CHARGE_USD}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.APIFY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registrationNumbers: [registrationNumber],
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`CAC lookup failed (${res.status}): ${await res.text()}`);
  }

  const items = (await res.json()) as ApifyDatasetItem[];
  const match = items[0];
  if (!match?.approvedName) return null;

  return {
    companyName: match.approvedName,
    rcNumber: match.rcNumber ?? registrationNumber,
    registrationNumberFormatted: match.registrationNumberFormatted ?? registrationNumber,
    classification: match.classification ?? "",
    classificationLabel: match.classificationLabel ?? "",
    status: match.status ?? "UNKNOWN",
    registrationDate: match.registrationDate ?? null,
    source: match.source ?? "CAC - Corporate Affairs Commission, Nigeria (public search)",
    sourceUrl: match.sourceUrl ?? "https://icrp.cac.gov.ng/public-search",
  };
}
