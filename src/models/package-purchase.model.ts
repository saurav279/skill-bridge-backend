import { db } from "../db/knex";

export type PackagePurchaseRow = {
  id: string;
  customer_name: string;
  customer_email: string;
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  amount: number;
  currency: string;
  package_name: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type CreatePackagePurchaseInput = {
  id: string;
  customerName: string;
  customerEmail: string;
  stripeSessionId: string;
  stripePaymentIntentId?: string | null;
  amount: number;
  currency: string;
  packageName: string;
};

const TABLE = "package_purchases";

export const PackagePurchaseModel = {
  async create(input: CreatePackagePurchaseInput): Promise<PackagePurchaseRow> {
    const [row] = await db<PackagePurchaseRow>(TABLE)
      .insert({
        id: input.id,
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        stripe_session_id: input.stripeSessionId,
        stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
        amount: input.amount,
        currency: input.currency,
        package_name: input.packageName,
      })
      .returning("*");

    return row;
  },

  async findBySessionId(
    stripeSessionId: string,
  ): Promise<PackagePurchaseRow | undefined> {
    return db<PackagePurchaseRow>(TABLE)
      .where({ stripe_session_id: stripeSessionId })
      .first();
  },
};
