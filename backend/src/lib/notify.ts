import { Resend } from "resend";
// No official types ship with this package — see types/africastalking.d.ts.
import AfricasTalkingInit from "africastalking";

// Sends a one-time verification code to a phone number or email.
// Falls back to logging (and returning) the code when no provider is
// configured, so the app is runnable end-to-end without SMS/email credentials.
//
// For a phone number, WhatsApp is tried first, falling back to SMS only if
// the WhatsApp send fails (not configured yet, number isn't on WhatsApp,
// template not approved, etc.) — WhatsApp delivery is effectively free
// (no per-message SMS cost) and reaches a richer client, but Meta requires
// a verified WhatsApp Business number and an approved "Authentication"
// template before any message can actually send, which takes real-world
// provisioning time; AFRICASTALKING_WHATSAPP_NUMBER/_TEMPLATE_ID stay
// unset until that's done, so this silently no-ops to SMS until then.
//
// SMS fallback order is WhatsApp (via Africa's Talking) -> Termii -> Africa's
// Talking SMS. Termii sits ahead of AT's own SMS send because AT's SMS
// sending has been failing account-side (401 "supplied authentication is
// invalid", unresolved as of this writing despite a regenerated key and a
// cleared account-verification banner — see AT support ticket). AT SMS is
// kept as a further fallback rather than removed outright, so if that issue
// resolves later it's still in the chain for free; AT's WhatsApp path is
// unaffected by the SMS-specific auth problem and stays first since it's
// effectively free (no per-message cost) and reaches a richer client — see
// trySendWhatsAppOtp. A plain international long code (what a Twilio US
// number is, from Nigeria's perspective) isn't reliably deliverable to
// Nigerian numbers — MTN, Airtel, and 9mobile reject numeric international
// sender IDs outright, since this app's users are predominantly Nigerian
// (+234 default country code) — hence routing through providers (AT,
// Termii) with real Nigerian delivery rather than a generic SMS API.
//
// Email goes through Resend rather than SendGrid — SendGrid/Twilio's unified
// account system rejected the signup for this domain outright ("can't
// activate your account for security reasons", no further detail given).
export async function sendOtp(identifier: string, code: string): Promise<{ devCode?: string }> {
  const isEmail = identifier.includes("@");

  if (isEmail) {
    const providerConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
    if (!providerConfigured) {
      console.log(`[WAY][dev-otp] ${identifier} -> ${code}`);
      return { devCode: code };
    }
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const { error } = await resend.emails.send({
      to: identifier,
      from: process.env.RESEND_FROM_EMAIL!,
      subject: `${code} is your WAY verification code`,
      text: `Your WAY verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your WAY verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
    });
    if (error) throw new Error(`Resend: ${error.message}`);
    return {};
  }

  const atConfigured = Boolean(process.env.AFRICASTALKING_API_KEY && process.env.AFRICASTALKING_USERNAME);
  const termiiConfigured = Boolean(process.env.TERMII_API_KEY);
  if (!atConfigured && !termiiConfigured) {
    console.log(`[WAY][dev-otp] ${identifier} -> ${code}`);
    return { devCode: code };
  }

  const message = `${code} is your WAY verification code. It expires in 10 minutes.`;

  if (atConfigured) {
    const africasTalking = AfricasTalkingInit({
      apiKey: process.env.AFRICASTALKING_API_KEY!,
      username: process.env.AFRICASTALKING_USERNAME!,
    });

    if (await trySendWhatsAppOtp(africasTalking, identifier, code)) return {};
    if (termiiConfigured && (await trySendTermiiSms(identifier, message))) return {};

    await africasTalking.SMS.send({
      to: [identifier],
      message,
      ...(process.env.AFRICASTALKING_SENDER_ID ? { senderId: process.env.AFRICASTALKING_SENDER_ID } : {}),
    });
    return {};
  }

  // Africa's Talking isn't configured at all — Termii is the only option,
  // so let a failure here throw (and surface) rather than swallowing it.
  await sendTermiiSms(identifier, message);
  return {};
}

// Returns true on a successful WhatsApp send, false whenever it should fall
// through to SMS instead (not configured yet, or the send itself failed) —
// never throws, since a WhatsApp problem must never block the SMS fallback.
async function trySendWhatsAppOtp(
  africasTalking: ReturnType<typeof AfricasTalkingInit>,
  identifier: string,
  code: string
): Promise<boolean> {
  const waNumber = process.env.AFRICASTALKING_WHATSAPP_NUMBER;
  const templateId = process.env.AFRICASTALKING_WHATSAPP_TEMPLATE_ID;
  if (!waNumber || !templateId) return false;

  try {
    await africasTalking.WHATSAPP.sendMessage({
      waNumber,
      phoneNumber: identifier,
      body: {
        templateId,
        // The approved "Authentication" template has no header component
        // (Meta's template editor requires this field regardless) and one
        // body variable — the code itself.
        headerValue: "",
        bodyValues: [code],
      },
    });
    return true;
  } catch (err) {
    console.warn(`[WAY][otp] WhatsApp send to ${identifier} failed, falling back to SMS:`, err);
    return false;
  }
}

// Termii (https://termii.com) — an Africa-focused SMS provider, added as a
// cheaper, independent fallback while Africa's Talking's own SMS sending is
// broken account-side (see sendOtp's comment). Plain REST call rather than
// an SDK: Termii doesn't ship an official Node client, and the API is a
// single JSON POST. Identifier is sent without a leading "+" (Termii/most
// Nigerian SMS gateways expect the bare international-format digits, e.g.
// "2348012345678") — `identifier` here is already E.164 from sign-in.
//
// Field names (api_key in the body, to/from/sms/type/channel) are per
// Termii's public developer reference as of this writing; their docs page
// couldn't be re-fetched to double-check during this change (returned a
// 404 when verifying), so the full response body is logged on every call,
// not just failures, until a live send confirms the exact response shape —
// trim that logging once confirmed.
async function sendTermiiSms(identifier: string, message: string): Promise<void> {
  const res = await fetch("https://api.ng.termii.com/api/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TERMII_API_KEY,
      to: identifier.replace(/^\+/, ""),
      from: process.env.TERMII_SENDER_ID || "Termii",
      sms: message,
      type: "plain",
      channel: "generic",
    }),
  });
  const body = await res.text();
  console.log(`[WAY][otp] Termii response for ${identifier} (status ${res.status}): ${body}`);
  if (!res.ok) {
    throw new Error(`Termii SMS failed (${res.status}): ${body}`);
  }
}

// Never-throws wrapper for use as a mid-chain fallback (WhatsApp -> Termii ->
// AT SMS) — mirrors trySendWhatsAppOtp's pattern. When Termii is the only
// configured provider, sendOtp calls sendTermiiSms directly instead so a
// failure still surfaces.
async function trySendTermiiSms(identifier: string, message: string): Promise<boolean> {
  try {
    await sendTermiiSms(identifier, message);
    return true;
  } catch (err) {
    console.warn(`[WAY][otp] Termii SMS to ${identifier} failed, falling back:`, err);
    return false;
  }
}
