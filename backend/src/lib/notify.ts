import twilio from "twilio";
import sgMail from "@sendgrid/mail";

// Sends a one-time verification code to a phone number or email.
// Falls back to logging (and returning) the code when no provider is
// configured, so the app is runnable end-to-end without SMS/email credentials.
export async function sendOtp(identifier: string, code: string): Promise<{ devCode?: string }> {
  const isEmail = identifier.includes("@");
  const providerConfigured = isEmail
    ? Boolean(process.env.SENDGRID_API_KEY)
    : Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);

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
    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
    await client.messages.create({
      to: identifier,
      from: process.env.TWILIO_FROM_NUMBER!,
      body: `${code} is your WAY verification code. It expires in 10 minutes.`,
    });
  }

  return {};
}
