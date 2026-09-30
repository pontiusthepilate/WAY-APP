import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { ALLOWED_CURRENCIES, isAllowedCurrency } from "../lib/currency";
import { PROFILE_SUMMARY_SELECT } from "../lib/profileSummary";
import {
  PAYSTACK_SUPPORTED_CURRENCIES,
  initializeTransaction,
  isPaystackConfigured,
  verifyTransaction,
} from "../lib/paystack";

const currencySchema = z.string().refine(isAllowedCurrency, {
  message: `Currency must be one of: ${ALLOWED_CURRENCIES.join(", ")}`,
});

const fundBody = z.object({
  profileId: z.string(),
  currency: currencySchema,
  amount: z.number().int().positive().max(1_000_000_00), // minor units, capped at 1,000,000.00
  method: z.enum(["card", "crypto"]),
});

const transferBody = z.object({
  fromProfileId: z.string(),
  toWayId: z.string(),
  currency: currencySchema,
  amount: z.number().int().positive(),
  note: z.string().max(280).optional(),
});

const historyQuery = z.object({
  profileId: z.string(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(30),
  withProfileId: z.string().optional(),
  withWayId: z.string().optional(),
});

const verifyFundBody = z.object({ profileId: z.string(), reference: z.string() });

async function getOrCreateWallet(profileId: string) {
  return prisma.wallet.upsert({ where: { profileId }, create: { profileId }, update: {} });
}

// Paystack requires an email on every transaction. Profiles aren't required
// to have one (phone-only signup is supported), so this falls back to a
// synthesized address — never shown to the user, only sent to Paystack.
async function resolveEmailForProfile(profile: { id: string; userId: string; wayId: string }): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: profile.userId } });
  return user?.email ?? `${profile.wayId}@way-user.app`;
}

async function creditWallet(profileId: string, currency: string, amount: number, method: "card") {
  const wallet = await getOrCreateWallet(profileId);
  const groupId = randomUUID();
  const [balance, transaction] = await prisma.$transaction([
    prisma.walletBalance.upsert({
      where: { walletId_currency: { walletId: wallet.id, currency } },
      create: { walletId: wallet.id, currency, amount },
      update: { amount: { increment: amount } },
    }),
    prisma.transaction.create({ data: { walletId: wallet.id, groupId, type: "fund", currency, amount, method } }),
  ]);
  return { balance: { currency: balance.currency, amount: balance.amount }, transaction };
}

async function withCounterparties<T extends { counterpartyProfileId: string | null }>(rows: T[]) {
  const ids = [...new Set(rows.map((r) => r.counterpartyProfileId).filter((id): id is string => !!id))];
  const profiles = ids.length
    ? await prisma.profile.findMany({ where: { id: { in: ids } }, select: PROFILE_SUMMARY_SELECT })
    : [];
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, counterparty: r.counterpartyProfileId ? byId.get(r.counterpartyProfileId) ?? null : null }));
}

export async function walletRoutes(app: FastifyInstance) {
  app.get("/wallet", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { profileId } = z.object({ profileId: z.string() }).parse(req.query);
    await assertOwnsProfile(userId, profileId);

    const wallet = await getOrCreateWallet(profileId);
    const balances = await prisma.walletBalance.findMany({ where: { walletId: wallet.id }, orderBy: { currency: "asc" } });
    reply.send({ walletId: wallet.id, balances: balances.map((b) => ({ currency: b.currency, amount: b.amount })) });
  });

  // "crypto" is a stubbed coming-soon path. "card" is real for NGN when
  // PAYSTACK_SECRET_KEY is configured (returns a checkout URL to open and
  // requires a follow-up call to /wallet/fund/verify); otherwise it falls
  // back to an instant simulated credit, same as before Paystack existed.
  app.post("/wallet/fund", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = fundBody.parse(req.body);
    const profile = await assertOwnsProfile(userId, body.profileId);

    if (body.method === "crypto") {
      return reply.status(501).send({ error: "Crypto funding is coming soon" });
    }

    const paystackEligible =
      isPaystackConfigured() && (PAYSTACK_SUPPORTED_CURRENCIES as readonly string[]).includes(body.currency);

    if (paystackEligible) {
      const reference = `way_${randomUUID()}`;
      await prisma.paystackPayment.create({
        data: { profileId: profile.id, currency: body.currency, amount: body.amount, reference },
      });

      try {
        const email = await resolveEmailForProfile(profile);
        const { authorizationUrl } = await initializeTransaction({
          email,
          amount: body.amount,
          currency: body.currency,
          reference,
          callbackUrl: process.env.PAYSTACK_CALLBACK_URL ?? "way://wallet-fund-callback",
        });
        return reply.status(202).send({ status: "requires_action", authorizationUrl, reference });
      } catch (err) {
        await prisma.paystackPayment.update({ where: { reference }, data: { status: "failed" } });
        return reply.status(502).send({ error: err instanceof Error ? err.message : "Could not start payment" });
      }
    }

    const result = await creditWallet(body.profileId, body.currency, body.amount, "card");
    reply.status(201).send({ status: "completed", ...result });
  });

  // Confirms a Paystack checkout actually succeeded before crediting anything
  // — the checkout redirect alone is never trusted, since a client could
  // forge a "success" callback without this server-to-server check.
  app.post("/wallet/fund/verify", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = verifyFundBody.parse(req.body);
    const profile = await assertOwnsProfile(userId, body.profileId);

    const payment = await prisma.paystackPayment.findUnique({ where: { reference: body.reference } });
    if (!payment || payment.profileId !== profile.id) return reply.status(404).send({ error: "Not found" });

    if (payment.status === "success") {
      const wallet = await getOrCreateWallet(profile.id);
      const balance = await prisma.walletBalance.findUnique({
        where: { walletId_currency: { walletId: wallet.id, currency: payment.currency } },
      });
      return reply.send({ status: "completed", balance: balance ?? { currency: payment.currency, amount: 0 } });
    }
    // A "payment didn't succeed" answer is itself a successful verification
    // call — this stays 200, not an error status, so the client can branch
    // on `status` in the body instead of catching an exception for it.
    if (payment.status === "failed") {
      return reply.send({ status: "failed", error: "Payment was not successful" });
    }

    const result = await verifyTransaction(body.reference);
    if (!result.success || result.amount !== payment.amount || result.currency !== payment.currency) {
      await prisma.paystackPayment.update({ where: { id: payment.id }, data: { status: "failed", verifiedAt: new Date() } });
      return reply.send({ status: "failed", error: result.gatewayResponse || "Payment was not successful" });
    }

    const credited = await creditWallet(profile.id, payment.currency, payment.amount, "card");
    await prisma.paystackPayment.update({ where: { id: payment.id }, data: { status: "success", verifiedAt: new Date() } });
    reply.send({ status: "completed", ...credited });
  });

  app.post("/wallet/transfer", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = transferBody.parse(req.body);
    const sender = await assertOwnsProfile(userId, body.fromProfileId);

    const receiver = await prisma.profile.findUnique({ where: { wayId: body.toWayId } });
    if (!receiver) return reply.status(404).send({ error: "That WAY doesn't exist" });
    if (receiver.id === sender.id) return reply.status(400).send({ error: "You can't send funds to yourself" });

    const senderWallet = await getOrCreateWallet(sender.id);
    const receiverWallet = await getOrCreateWallet(receiver.id);
    const groupId = randomUUID();

    try {
      const outTx = await prisma.$transaction(async (tx) => {
        const debit = await tx.walletBalance.updateMany({
          where: { walletId: senderWallet.id, currency: body.currency, amount: { gte: body.amount } },
          data: { amount: { decrement: body.amount } },
        });
        if (debit.count === 0) throw new InsufficientBalanceError();

        await tx.walletBalance.upsert({
          where: { walletId_currency: { walletId: receiverWallet.id, currency: body.currency } },
          create: { walletId: receiverWallet.id, currency: body.currency, amount: body.amount },
          update: { amount: { increment: body.amount } },
        });

        await tx.transaction.create({
          data: {
            walletId: receiverWallet.id,
            groupId,
            type: "transfer_in",
            currency: body.currency,
            amount: body.amount,
            counterpartyProfileId: sender.id,
            description: body.note,
          },
        });

        return tx.transaction.create({
          data: {
            walletId: senderWallet.id,
            groupId,
            type: "transfer_out",
            currency: body.currency,
            amount: body.amount,
            counterpartyProfileId: receiver.id,
            description: body.note,
          },
        });
      });
      reply.status(201).send(outTx);
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        return reply.status(402).send({ error: "Insufficient balance" });
      }
      throw err;
    }
  });

  app.get("/wallet/transactions", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const q = historyQuery.parse(req.query);
    await assertOwnsProfile(userId, q.profileId);
    const wallet = await getOrCreateWallet(q.profileId);

    let counterpartyProfileId = q.withProfileId;
    if (!counterpartyProfileId && q.withWayId) {
      const p = await prisma.profile.findUnique({ where: { wayId: q.withWayId } });
      counterpartyProfileId = p?.id;
    }

    const transactions = await prisma.transaction.findMany({
      where: { walletId: wallet.id, ...(counterpartyProfileId ? { counterpartyProfileId } : {}) },
      take: q.limit,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
    });

    const withCp = await withCounterparties(transactions);
    return { transactions: withCp, nextCursor: transactions.length === q.limit ? transactions[transactions.length - 1].id : null };
  });
}

class InsufficientBalanceError extends Error {}
