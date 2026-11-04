import sgMail from "@sendgrid/mail";
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
export async function sendOtp(identifier: string, code: string): Promise<{ devCode?: string }> {
  const isEmail = identifier.includes("@");
  const providerConfigured = isEmail
    ? Boolean(process.env.SENDGRID_API_KEY)
    : Boolean(process.env.AFRICASTALKING_API_KEY && process.env.AFRICASTALKING_USERNAME);

  if (!providerConfigured) {
    console.log(`[WAY][dev-otp] ${identifier} -> ${code}`);
    return { devCode: code };
  }

  if (isEmail) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
    await sgMail.send({
      to: identifier,
      from: process.env.SENDGRID_FROM_EMAIL!,
      subject: `${code} is your WAY verification code`,
      text: `Your WAY verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your WAY verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
    });
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
