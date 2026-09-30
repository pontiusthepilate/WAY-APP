// Sends a one-time verification code to a phone number or email.
// Falls back to logging (and returning) the code when no provider is
// configured, so the app is runnable end-to-end without SMS/email credentials.
export async function sendOtp(identifier: string, code: string): Promise<{ devCode?: string }> {
  const isEmail = identifier.includes("@");
  const providerConfigured = isEmail
    ? Boolean(process.env.SENDGRID_API_KEY)
    : Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);

  if (!providerConfigured) {
    console.log(`[WAY][dev-otp] ${identifier} -> ${code}`);
    return { devCode: code };
  }

  // TODO: wire up Twilio (SMS) / SendGrid (email) here using the env vars
  // in .env.example once real credentials are available.
  console.log(`[WAY][otp] would send ${code} to ${identifier} via ${isEmail ? "email" : "sms"} provider`);
  return {};
}
