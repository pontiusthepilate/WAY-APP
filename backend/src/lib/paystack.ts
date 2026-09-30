// Thin wrapper around Paystack's REST API. Only NGN is wired up — Paystack
// merchant accounts are approved for specific currencies by their business
// country, and a fresh account only reliably supports NGN, so other wallet
// currencies keep using the simulated funding path (see routes/wallet.ts).
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
  amount: number; // minor units (kobo)
  currency: string;
  reference: string;
  callbackUrl: string;
}): Promise<InitializeResult> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: input.email,
      amount: input.amount,
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
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
