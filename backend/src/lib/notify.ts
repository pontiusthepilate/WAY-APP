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
// SMS goes through Africa's Talking rather than a generic SMS API: a plain
// international long code (what a Twilio US number is, from Nigeria's
// perspective) isn't reliably deliverable to Nigerian numbers — MTN, Airtel,
// and 9mobile reject numeric international sender IDs outright, since this
// app's users are predominantly Nigerian (+234 default country code). The
// same Africa's Talking account/app provides WhatsApp too (same SDK, a
// `WHATSAPP` namespace alongside `SMS`), so no second provider relationship
// is needed for the fallback.
//
// Email goes through Resend rather than SendGrid — SendGrid/Twilio's unified
// account system rejected the signup for this domain outright ("can't
// activate your account for security reasons", no further detail given).
export async function sendOtp(identifier: string, code: string): Promise<{ devCode?: string }> {
  const isEmail = identifier.includes("@");
  const providerConfigured = isEmail
    ? Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)
    : Boolean(process.env.AFRICASTALKING_API_KEY && process.env.AFRICASTALKING_USERNAME);

  if (!providerConfigured) {
    console.log(`[WAY][dev-otp] ${identifier} -> ${code}`);
    return { devCode: code };
  }

  if (isEmail) {
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

  const africasTalking = AfricasTalkingInit({
    apiKey: process.env.AFRICASTALKING_API_KEY!,
    username: process.env.AFRICASTALKING_USERNAME!,
  });

  if (await trySendWhatsAppOtp(africasTalking, identifier, code)) return {};

  await africasTalking.SMS.send({
    to: [identifier],
    message: `${code} is your WAY verification code. It expires in 10 minutes.`,
    ...(process.env.AFRICASTALKING_SENDER_ID ? { senderId: process.env.AFRICASTALKING_SENDER_ID } : {}),
  });
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
