import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { sendOtp } from "../lib/notify";

const OTP_TTL_MINUTES = 10;
const FREE_PROFILE_LIMIT = 2;

const identifierSchema = z.string().min(3).refine(
  (v) => v.includes("@") || /^\+?[0-9]{7,15}$/.test(v),
  "Must be a valid email or phone number (E.164, e.g. +15551234567)"
);

const requestOtpBody = z.object({ identifier: identifierSchema });
const verifyOtpBody = z.object({ identifier: identifierSchema, code: z.string().length(6) });

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function authRoutes(app: FastifyInstance) {
  // Step 1 of sign up/sign in: send a 6-digit code to the phone or email
  // that will act as the account's parent/key identifier.
  app.post("/auth/request-otp", async (req, reply) => {
    const { identifier } = requestOtpBody.parse(req.body);

    const code = generateCode();
    await prisma.otpCode.create({
      data: {
        identifier,
        code,
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      },
    });

    const { devCode } = await sendOtp(identifier, code);
    reply.send({ sent: true, ...(devCode ? { devCode } : {}) });
  });

  // Step 2: verify the code, then create the User (if new) and hand back a
  // session token plus whatever profiles already exist under this identity.
  app.post("/auth/verify-otp", async (req, reply) => {
    const { identifier, code } = verifyOtpBody.parse(req.body);

    const otp = await prisma.otpCode.findFirst({
      where: { identifier, code, consumed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!otp) {
      return reply.status(400).send({ error: "Invalid or expired code" });
    }
    await prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });

    const isEmail = identifier.includes("@");
    let user = await prisma.user.findFirst({
      where: isEmail ? { email: identifier } : { phone: identifier },
    });
    const isNewUser = !user;
    if (!user) {
      user = await prisma.user.create({
        data: isEmail ? { email: identifier } : { phone: identifier },
      });
    }

    const profiles = await prisma.profile.findMany({ where: { userId: user.id } });
    const token = await reply.jwtSign({ userId: user.id }, { expiresIn: "30d" });

    reply.send({
      token,
      userId: user.id,
      isNewUser,
      freeProfileSlotsRemaining: Math.max(0, FREE_PROFILE_LIMIT - profiles.length),
      profiles,
    });
  });
}
