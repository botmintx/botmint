/** Mock checkout only. This module never calls X Money. */

export const MINT_PRICE_USD = "10.00";

export type PaymentQuote = {
  amountUsd: typeof MINT_PRICE_USD;
  rail: "mock";
};

export type PaymentReceipt =
  | {
      ok: true;
      amountUsd: typeof MINT_PRICE_USD;
      rail: "mock";
      tokenId: number;
      payer: string;
      ref: string;
    }
  | { ok: false; reason: string };

export interface PaymentAdapter {
  readonly rail: "mock";
  quote(): PaymentQuote;
  checkout(input: { tokenId: number; payer: string }): Promise<PaymentReceipt>;
}

export class MockXMoneyAdapter implements PaymentAdapter {
  readonly rail = "mock" as const;

  quote(): PaymentQuote {
    return { amountUsd: MINT_PRICE_USD, rail: "mock" };
  }

  async checkout(input: { tokenId: number; payer: string }): Promise<PaymentReceipt> {
    if (!Number.isInteger(input.tokenId) || input.tokenId < 1 || input.tokenId > 10000) {
      return { ok: false, reason: "token" };
    }
    if (!input.payer) return { ok: false, reason: "payer" };
    return {
      ok: true,
      amountUsd: MINT_PRICE_USD,
      rail: "mock",
      tokenId: input.tokenId,
      payer: input.payer,
      ref: `mock:${input.tokenId}:${input.payer.toLowerCase()}`,
    };
  }
}

export function assertPaid(
  receipt: PaymentReceipt,
): asserts receipt is PaymentReceipt & { ok: true } {
  if (!receipt.ok) throw new Error(`payment not confirmed: ${receipt.reason}`);
  if (receipt.amountUsd !== MINT_PRICE_USD || receipt.rail !== "mock") {
    throw new Error("payment is not the mock $10.00 checkout");
  }
}
