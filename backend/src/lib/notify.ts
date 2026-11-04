import { Resend } from "resend";
// No official types ship with this package — see types/africastalking.d.ts.
import AfricasTalkingInit from "africastalking";

// Sends a one-time verification code to a phone number or email.
// Falls back to logging (and returning) the code when no provider is
// configured, so the app is runnable end-to-end without SMS/email credentials.
//
// SMS goes through Africa's Talking rather than a generic SMS API: a plain
// international long code (what a Twilio US number is, from Nigeria's
// perspective) isn't reliably deliverable to Nigerian numbers — MTN, Airtel,
// and 9mobile reject numeric international sender IDs outright, since this
// app's users are predominantly Nigerian (+234 default country code).
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
  } else {
    const africasTalking = AfricasTalkingInit({
      apiKey: process.env.AFRICASTALKING_API_KEY!,
      username: process.env.AFRICASTALKING_USERNAME!,
    });
    await africasTalking.SMS.send({
      to: [identifier],
      message: `${code} is your WAY verification code. It expires in 10 minutes.`,
      ...(process.env.AFRICASTALKING_SENDER_ID ? { senderId: process.env.AFRICASTALKING_SENDER_ID } : {}),
    });
  }

  return {};
}
