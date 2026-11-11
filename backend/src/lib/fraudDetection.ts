// Risk-scores a wallet transfer against signals already sitting in the
// database (velocity, amount history, account age, counterparty history,
// recent funding) — deliberately NOT an LLM call, same reasoning as
// recommendations.ts: this is a ranking/scoring problem, not a
// generation/classification task, and the one code path in this app
// where latency and a third-party dependency matter least is moving
// real money. Policy is "allow + flag for review" (see routes/wallet.ts)
// — this function only scores, it never blocks anything itself.
import { prisma } from "./db";

// Each weight is named/tunable independently; triggered weights sum to
// the final score. Tune FLAG_THRESHOLD and these during verification.
const WEIGHT_NEW_ACCOUNT = 0.25;
const WEIGHT_AMOUNT_ANOMALY = 0.3;
const WEIGHT_VELOCITY = 0.25;
const WEIGHT_NEW_COUNTERPARTY = 0.25;
const WEIGHT_FUND_DRAIN = 0.35; // highest — the clearest mule-account signature

const NEW_ACCOUNT_DAYS = 2;
const AMOUNT_ANOMALY_MULTIPLIER = 4;
const FIRST_TRANSFER_CAP = 100_000_00; // minor units — flat cap used when there's no history to compare against
const VELOCITY_WINDOW_MINUTES = 10;
const VELOCITY_MAX_COUNT = 4;
const FUND_DRAIN_WINDOW_MINUTES = 15;
const FUND_DRAIN_FRACTION = 0.8;

// At or below WEIGHT_FUND_DRAIN so that signal alone is enough to flag
// (the clearest single mule-pattern signature); two moderate signals
// (e.g. new-account + new-counterparty, 0.25+0.25) also cross it.
export const FLAG_THRESHOLD = 0.35;

export interface TransferRiskParams {
  senderWalletId: string;
  senderProfileId: string;
  senderProfileCreatedAt: Date;
  counterpartyProfileId: string;
  currency: string;
  amount: number;
}

export interface TransferRiskResult {
  flagged: boolean;
  score: number;
  reasons: string[];
}

const SAFE_RESULT: TransferRiskResult = { flagged: false, score: 0, reasons: [] };

export async function assessTransferRisk(params: TransferRiskParams): Promise<TransferRiskResult> {
  try {
    const { senderWalletId, senderProfileCreatedAt, counterpartyProfileId, currency, amount } = params;
    let score = 0;
    const reasons: string[] = [];
    const now = new Date();

    const accountAgeMs = now.getTime() - senderProfileCreatedAt.getTime();
    if (accountAgeMs < NEW_ACCOUNT_DAYS * 24 * 60 * 60 * 1000) {
      score += WEIGHT_NEW_ACCOUNT;
      reasons.push(`New account (under ${NEW_ACCOUNT_DAYS} days old)`);
    }

    const pastTransfersOut = await prisma.transaction.findMany({
      where: { walletId: senderWalletId, type: "transfer_out", currency },
      select: { amount: true, counterpartyProfileId: true },
    });

    if (pastTransfersOut.length === 0) {
      if (amount > FIRST_TRANSFER_CAP) {
        score += WEIGHT_AMOUNT_ANOMALY;
        reasons.push("Large first transfer");
      }
    } else {
      const avg = pastTransfersOut.reduce((sum, t) => sum + t.amount, 0) / pastTransfersOut.length;
      if (amount > avg * AMOUNT_ANOMALY_MULTIPLIER) {
        score += WEIGHT_AMOUNT_ANOMALY;
        reasons.push("Amount far above usual");
      }
    }

    const hasPriorTransferToCounterparty = pastTransfersOut.some((t) => t.counterpartyProfileId === counterpartyProfileId);
    if (!hasPriorTransferToCounterparty && amount > FIRST_TRANSFER_CAP) {
      score += WEIGHT_NEW_COUNTERPARTY;
      reasons.push("First transfer to this recipient at a high amount");
    }

    const velocityWindowStart = new Date(now.getTime() - VELOCITY_WINDOW_MINUTES * 60 * 1000);
    const recentTransferCount = await prisma.transaction.count({
      where: { walletId: senderWalletId, type: "transfer_out", createdAt: { gte: velocityWindowStart } },
    });
    if (recentTransferCount >= VELOCITY_MAX_COUNT) {
      score += WEIGHT_VELOCITY;
      reasons.push("Rapid succession of transfers");
    }

    const fundDrainWindowStart = new Date(now.getTime() - FUND_DRAIN_WINDOW_MINUTES * 60 * 1000);
    const recentFund = await prisma.transaction.findFirst({
      where: {
        walletId: senderWalletId,
        type: "fund",
        currency,
        createdAt: { gte: fundDrainWindowStart },
        amount: { gte: amount * FUND_DRAIN_FRACTION },
      },
    });
    if (recentFund) {
      score += WEIGHT_FUND_DRAIN;
      reasons.push("Funded and sent out immediately after");
    }

    return { flagged: score >= FLAG_THRESHOLD, score, reasons };
  } catch (err) {
    console.error("[WAY][fraudDetection] assessTransferRisk failed", err);
    return SAFE_RESULT;
  }
}
