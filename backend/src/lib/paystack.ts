// Thin wrapper around Paystack's REST API. Only NGN is wired up — Paystack
// merchant accounts are approved for specific currencies by their business
// country, and a fresh account only reliably supports NGN, so other wallet
// currencies keep using the simulated funding path (see routes/wallet.ts).
import { createHmac, timingSafeEqual } from "node:crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

export const PAYSTACK_SUPPORTED_CURRENCIES = ["NGN"] as const;

export function isPaystackConfigured(): boolean {
  return !!process.env.PAYSTACK_SECRET_KEY;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

interface InitializeResult {
  authorizationUrl: string;
  accessCode: string;
}

interface PaystackApiResponse {
  status: boolean;
  message?: string;
  data?: Record<string, any>;
}

export async function initializeTransaction(input: {
  email: string;
  // Omitted (along with currency) when `plan` is set — the plan's own
  // amount/currency wins, and sending a mismatched amount alongside a plan
  // risks Paystack rejecting the request.
  amount?: number; // minor units (kobo)
  currency?: string;
  reference: string;
  callbackUrl: string;
  // Passing a Paystack plan code auto-creates the recurring subscription
  // (tied to the customer) the moment this first charge succeeds — see
  // routes/subscriptions.ts.
  plan?: string;
}): Promise<InitializeResult> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: input.email,
      reference: input.reference,
      callback_url: input.callbackUrl,
      ...(input.plan
        ? { plan: input.plan }
        : { amount: input.amount, currency: input.currency }),
    }),
  });
  const body = (await res.json()) as PaystackApiResponse;
  if (!res.ok || !body.status || !body.data) {
    throw new Error(body?.message ?? `Paystack initialize failed (${res.status})`);
  }
  return { authorizationUrl: body.data.authorization_url, accessCode: body.data.access_code };
}

interface VerifyResult {
  success: boolean;
  amount: number;
  currency: string;
  gatewayResponse: string;
}

export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: authHeaders(),
  });
  const body = (await res.json()) as PaystackApiResponse;
  if (!res.ok || !body.status || !body.data) {
    throw new Error(body?.message ?? `Paystack verify failed (${res.status})`);
  }
  return {
    success: body.data.status === "success",
    amount: body.data.amount,
    currency: body.data.currency,
    gatewayResponse: body.data.gateway_response,
  };
}

interface PlanResult {
  amount: number; // minor units (kobo) — the live price, read fresh every
  // time rather than cached/hardcoded, so an admin editing the price in the
  // Paystack dashboard takes effect with no app deploy.
  currency: string;
  interval: string; // e.g. "monthly"
}

export async function getPlan(planCode: string): Promise<PlanResult> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/plan/${encodeURIComponent(planCode)}`, {
    headers: authHeaders(),
  });
  const body = (await res.json()) as PaystackApiResponse;
  if (!res.ok || !body.status || !body.data) {
    throw new Error(body?.message ?? `Paystack plan lookup failed (${res.status})`);
  }
  return { amount: body.data.amount, currency: body.data.currency, interval: body.data.interval };
}

// Paystack signs every webhook body with HMAC-SHA512 over the secret key —
// verifying this is the only thing that distinguishes a real Paystack event
// from anyone who can guess this route's URL and POST to it. Needs the raw
// (pre-JSON-parsed) body; see routes/subscriptions.ts's content-type parser.
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY ?? "").update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signatureHeader, "utf8");
  return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
}
