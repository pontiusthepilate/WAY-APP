import { z } from "zod";
import { prisma } from "./db";

// Shared by /auth/* (sign up/sign in) and routes/users.ts (change phone/email
// while already signed in) — anywhere a 6-digit code needs to be generated or
// checked against the OtpCode table.
export const identifierSchema = z.string().min(3).refine(
  (v) => v.includes("@") || /^\+?[0-9]{7,15}$/.test(v),
  "Must be a valid email or phone number (E.164, e.g. +15551234567)"
);

export function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Looks up an unconsumed, unexpired code for the identifier and marks it
// consumed. Returns false (rather than throwing) so callers can shape their
// own error response.
export async function verifyAndConsumeOtp(identifier: string, code: string): Promise<boolean> {
  const otp = await prisma.otpCode.findFirst({
    where: { identifier, code, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return false;
  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });
  return true;
}
