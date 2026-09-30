import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { ALLOWED_CURRENCIES, isAllowedCurrency } from "../lib/currency";
import { PROFILE_SUMMARY_SELECT } from "../lib/profileSummary";

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

async function getOrCreateWallet(profileId: string) {
  return prisma.wallet.upsert({ where: { profileId }, create: { profileId }, update: {} });
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

  // Simulated funding — no real card/crypto processor wired up yet (see README).
  // "card" completes instantly; "crypto" is a stubbed coming-soon path.
  app.post("/wallet/fund", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = fundBody.parse(req.body);
    await assertOwnsProfile(userId, body.profileId);

    if (body.method === "crypto") {
      return reply.status(501).send({ error: "Crypto funding is coming soon" });
    }

    const wallet = await getOrCreateWallet(body.profileId);
    const groupId = randomUUID();

    const [balance, transaction] = await prisma.$transaction([
      prisma.walletBalance.upsert({
        where: { walletId_currency: { walletId: wallet.id, currency: body.currency } },
        create: { walletId: wallet.id, currency: body.currency, amount: body.amount },
        update: { amount: { increment: body.amount } },
      }),
      prisma.transaction.create({
        data: {
          walletId: wallet.id,
          groupId,
          type: "fund",
          currency: body.currency,
          amount: body.amount,
          method: "card",
        },
      }),
    ]);

    reply.status(201).send({ balance: { currency: balance.currency, amount: balance.amount }, transaction });
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
