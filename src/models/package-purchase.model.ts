import { db } from "../db/knex";
import type { AdminListQuery } from "../types/admin";

export type PackagePurchaseRow = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
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
  customerPhone: string | null;
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
        customer_phone: input.customerPhone ?? null,
        stripe_session_id: input.stripeSessionId,
        stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
        amount: input.amount,
        currency: input.currency,
        package_name: input.packageName,
      })
      .returning("*");

    console.log(" Package purchase created for email  ", input.customerEmail);

    return row;
  },

  async findBySessionId(
    stripeSessionId: string,
  ): Promise<PackagePurchaseRow | undefined> {
    return db<PackagePurchaseRow>(TABLE)
      .where({ stripe_session_id: stripeSessionId })
      .first();
  },

  async findById(id: string): Promise<PackagePurchaseRow | undefined> {
    return db<PackagePurchaseRow>(TABLE).where({ id }).first();
  },

  async listForAdmin(
    query: AdminListQuery,
  ): Promise<{ rows: PackagePurchaseRow[]; total: number }> {
    const q = db<PackagePurchaseRow>(TABLE);

    if (query.name?.trim()) {
      q.whereILike("customer_name", `%${query.name.trim()}%`);
    }
    if (query.email?.trim()) {
      q.whereILike("customer_email", `%${query.email.trim()}%`);
    }
    if (query.packageName?.trim()) {
      q.where("package_name", query.packageName.trim());
    }
    if (query.from?.trim()) {
      q.where("created_at", ">=", query.from);
    }
    if (query.to?.trim()) {
      q.where("created_at", "<=", query.to);
    }


    const countRow = await q.clone().count<{ count: string }>("id as count").first();
    const rows = await q
      .clone()
      .orderBy("updated_at", query.order)
      .offset((query.page - 1) * query.limit)
      .limit(query.limit);

    return { rows, total: Number(countRow?.count ?? 0) };
  },
};
