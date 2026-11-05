import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/db";
import { requireUser } from "../lib/auth";
import { getPlan, initializeTransaction, isPaystackConfigured, verifyTransaction, verifyWebhookSignature } from "../lib/paystack";

// Only "podcast" exists today, but kept free-form (not a literal "podcast")
// in case a future paid profile kind reuses this same subscription table.
const PODCAST_KIND = "podcast";

const initializeBody = z.object({});

const verifyBody = z.object({ reference: z.string() });

async function resolveEmailForUser(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.email ?? `${userId}@way-user.app`;
}

// How many active podcast subscriptions a user holds, vs. how many podcast
// profiles they've already created with them — the difference is how many
// more podcast profiles they're entitled to create right now.
async function podcastSlotStatus(userId: string) {
  const [activeSlots, usedSlots] = await Promise.all([
    prisma.subscription.count({ where: { userId, kind: PODCAST_KIND, status: "active" } }),
    prisma.profile.count({ where: { userId, kind: PODCAST_KIND } }),
  ]);
  return { activeSlots, usedSlots };
}

export async function subscriptionRoutes(app: FastifyInstance) {
  // Paystack's webhook signature is computed over the exact raw request
  // bytes — Fastify's default JSON parser would consume and reserialize the
  // body, which can change whitespace/key order and break the signature
  // check. This parser (scoped to this plugin's routes only, via Fastify's
  // per-encapsulation-context content-type parsers) keeps the raw buffer
  // alongside the parsed body for the one route that needs it.
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
    (req as any).rawBody = body;
    try {
      done(null, body.length ? JSON.parse(body.toString("utf8")) : {});
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.get("/subscriptions/podcast/plan", async (_req, reply) => {
    const planCode = process.env.PAYSTACK_PODCAST_PLAN_CODE;
    if (!isPaystackConfigured() || !planCode) {
      return reply.status(503).send({ error: "Podcast subscriptions aren't configured yet" });
    }
    const plan = await getPlan(planCode);
    reply.send(plan);
  });

  app.get("/subscriptions/podcast/status", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    reply.send(await podcastSlotStatus(userId));
  });

  app.post("/subscriptions/podcast/initialize", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    initializeBody.parse(req.body ?? {});

    const planCode = process.env.PAYSTACK_PODCAST_PLAN_CODE;
    if (!isPaystackConfigured() || !planCode) {
      return reply.status(503).send({ error: "Podcast subscriptions aren't configured yet" });
    }

    const reference = `way_sub_${randomUUID()}`;
    await prisma.subscription.create({
      data: { userId, kind: PODCAST_KIND, reference, planCode },
    });

    try {
      const email = await resolveEmailForUser(userId);
      const { authorizationUrl } = await initializeTransaction({
        email,
        reference,
        plan: planCode,
        callbackUrl: process.env.PAYSTACK_PODCAST_CALLBACK_URL ?? "way://podcast-subscribe-callback",
      });
      reply.status(202).send({ authorizationUrl, reference });
    } catch (err) {
      await prisma.subscription.update({ where: { reference }, data: { status: "cancelled" } });
      throw err;
    }
  });

  app.post("/subscriptions/podcast/verify", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = verifyBody.parse(req.body);

    const subscription = await prisma.subscription.findUnique({ where: { reference: body.reference } });
    if (!subscription || subscription.userId !== userId) {
      return reply.status(404).send({ error: "Subscription not found" });
    }

    const result = await verifyTransaction(body.reference);
    if (!result.success) {
      return reply.send({ status: subscription.status, error: result.gatewayResponse });
    }

    const updated = await prisma.subscription.update({
      where: { reference: body.reference },
      // The webhook (subscription.create/charge.success) is the real source
      // of truth for currentPeriodEnd going forward — this is only so the
      // user doesn't have to wait on a webhook to use what they just paid
      // for, so it leaves currentPeriodEnd for the webhook to fill in.
      data: { status: "active" },
    });
    reply.send({ status: updated.status });
  });

  app.post("/webhooks/paystack", async (req, reply) => {
    const signature = req.headers["x-paystack-signature"] as string | undefined;
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody || !verifyWebhookSignature(rawBody.toString("utf8"), signature)) {
      return reply.status(401).send({ error: "Invalid signature" });
    }

    const event = req.body as { event?: string; data?: Record<string, any> };
    const data = event.data ?? {};

    // Field shapes below match Paystack's documented webhook payloads;
    // confirmed against their dashboard's "Send test webhook" tool during
    // verification (see the plan's step 4) rather than assumed blind.
    switch (event.event) {
      case "subscription.create": {
        // No reference to match on here — the customer's email + our own
        // most recent pending podcast row for them is the link instead.
        const email: string | undefined = data.customer?.email;
        const user = email ? await prisma.user.findFirst({ where: { email } }) : null;
        if (user) {
          await prisma.subscription.updateMany({
            where: { userId: user.id, kind: PODCAST_KIND, status: { in: ["pending", "active"] } },
            data: {
              status: "active",
              paystackCustomerCode: data.customer?.customer_code ?? undefined,
              paystackSubscriptionCode: data.subscription_code ?? undefined,
              currentPeriodEnd: data.next_payment_date ? new Date(data.next_payment_date) : undefined,
            },
          });
        }
        break;
      }
      // Renewal charges: Paystack's invoice events carry the subscription
      // code directly, which is the reliable link back to our row (unlike
      // charge.success, which doesn't consistently include it).
      case "invoice.update":
      case "invoice.payment_failed": {
        const subscriptionCode: string | undefined = data.subscription?.subscription_code;
        if (subscriptionCode) {
          await prisma.subscription.updateMany({
            where: { paystackSubscriptionCode: subscriptionCode },
            data:
              event.event === "invoice.update" && data.status === "success"
                ? { status: "active", currentPeriodEnd: data.period_end ? new Date(data.period_end) : undefined }
                : { status: "expired" },
          });
        }
        break;
      }
      case "subscription.disable":
      case "subscription.not_renew": {
        const subscriptionCode: string | undefined = data.subscription_code;
        if (subscriptionCode) {
          await prisma.subscription.updateMany({
            where: { paystackSubscriptionCode: subscriptionCode },
            data: { status: "cancelled" },
          });
        }
        break;
      }
      default:
        break;
    }

    reply.status(200).send({ received: true });
  });
}
