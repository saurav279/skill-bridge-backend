import { db } from "../db/knex";
import type { AdminListQuery } from "../types/admin";
import type { PaymentPlanStatus } from "../types/installment";
import type { Knex } from "knex";

export type PaymentPlanRow = {
  id: string;
  user_id: string;
  package_name: string;
  total_amount: number;
  currency: string;
  installment_count: number;
  interval_days: number;
  first_due_at: Date | string;
  cancelled_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type PaymentPlanListRow = PaymentPlanRow & {
  paid_amount: string | number;
  paid_count: string | number;
  next_due_at: Date | string | null;
  user_name: string;
  user_email: string;
  user_phone: string | null;
  user_lead_id: string | null;
};

export type PaymentPlanStatusCountsRow = {
  total: number;
  on_track: number;
  overdue: number;
  complete: number;
  cancelled: number;
};

export type CreatePaymentPlanInput = {
  id: string;
  userId: string;
  packageName: string;
  totalAmount: number;
  currency: string;
  installmentCount: number;
  intervalDays: number;
  firstDueAt: string;
};

const TABLE = "payment_plans";

export const PaymentPlanModel = {
  async create(input: CreatePaymentPlanInput): Promise<PaymentPlanRow> {
    const [row] = await db<PaymentPlanRow>(TABLE)
      .insert({
        id: input.id,
        user_id: input.userId,
        package_name: input.packageName,
        total_amount: input.totalAmount,
        currency: input.currency,
        installment_count: input.installmentCount,
        interval_days: input.intervalDays,
        first_due_at: input.firstDueAt,
      })
      .returning("*");

    return row;
  },

  async findById(id: string): Promise<PaymentPlanRow | undefined> {
    return db<PaymentPlanRow>(TABLE).where({ id }).first();
  },

  async cancel(id: string): Promise<PaymentPlanRow | undefined> {
    const [row] = await db<PaymentPlanRow>(TABLE)
      .where({ id })
      .whereNull("cancelled_at")
      .update({
        cancelled_at: db.fn.now() as unknown as Date,
        updated_at: db.fn.now() as unknown as Date,
      })
      .returning("*");
    return row;
  },

  async touch(id: string): Promise<void> {
    await db<PaymentPlanRow>(TABLE)
      .where({ id })
      .update({ updated_at: db.fn.now() as unknown as Date });
  },

  async refreshTotalAmount(id: string): Promise<PaymentPlanRow | undefined> {
    const sumRow = await db("installments")
      .where({ plan_id: id })
      .sum<{ total: string | number }>("amount as total")
      .first();

    const [row] = await db<PaymentPlanRow>(TABLE)
      .where({ id })
      .update({
        total_amount: Number(sumRow?.total ?? 0),
        updated_at: db.fn.now() as unknown as Date,
      })
      .returning("*");
    return row;
  },

  async listForAdmin(
    query: AdminListQuery,
  ): Promise<{ rows: PaymentPlanListRow[]; total: number }> {
    const q = db(TABLE).join("users", "users.id", "payment_plans.user_id");

    if (query.name?.trim()) {
      q.whereILike("users.name", `%${query.name.trim()}%`);
    }
    if (query.email?.trim()) {
      q.whereILike("users.email", `%${query.email.trim()}%`);
    }
    if (query.packageName?.trim()) {
      q.where("payment_plans.package_name", query.packageName.trim());
    }
    if (query.from?.trim()) {
      q.where("payment_plans.created_at", ">=", query.from);
    }
    if (query.to?.trim()) {
      q.where("payment_plans.created_at", "<=", query.to);
    }
    if (query.leadId?.trim()) {
      q.where("users.lead_id", query.leadId.trim());
    }
    if (query.userId?.trim()) {
      q.where("payment_plans.user_id", query.userId.trim());
    }
    applyPlanStatusFilter(q, query.status);

    const countRow = await q
      .clone()
      .clearSelect()
      .count<{ count: string }>("payment_plans.id as count")
      .first();

    const paidAmount = db("installments")
      .sum("amount")
      .whereRaw("installments.plan_id = payment_plans.id")
      .where("status", "paid");

    const paidCount = db("installments")
      .count("*")
      .whereRaw("installments.plan_id = payment_plans.id")
      .where("status", "paid");

    const nextDueAt = db("installments")
      .min("due_at")
      .whereRaw("installments.plan_id = payment_plans.id")
      .whereNotIn("status", ["paid", "cancelled"]);

    const rows = await q
      .clone()
      .select(
        "payment_plans.*",
        "users.name as user_name",
        "users.email as user_email",
        "users.phone as user_phone",
        "users.lead_id as user_lead_id",
        paidAmount.as("paid_amount"),
        paidCount.as("paid_count"),
        nextDueAt.as("next_due_at"),
      )
      .orderBy("payment_plans.updated_at", query.order)
      .offset((query.page - 1) * query.limit)
      .limit(query.limit);

    return { rows: rows as PaymentPlanListRow[], total: Number(countRow?.count ?? 0) };
  },

  async statusCounts(): Promise<PaymentPlanStatusCountsRow> {
    const result = await db.raw<{ rows: PaymentPlanStatusCountsRow[] }>(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE cancelled_at IS NULL
            AND (
              SELECT COUNT(*) FROM installments i
              WHERE i.plan_id = payment_plans.id AND i.status = 'paid'
            ) < installment_count
            AND NOT EXISTS (
              SELECT 1 FROM installments i
              WHERE i.plan_id = payment_plans.id
                AND i.status NOT IN ('paid', 'cancelled')
                AND i.due_at < CURRENT_DATE
            )
        )::int AS on_track,
        COUNT(*) FILTER (
          WHERE cancelled_at IS NULL
            AND EXISTS (
              SELECT 1 FROM installments i
              WHERE i.plan_id = payment_plans.id
                AND i.status NOT IN ('paid', 'cancelled')
                AND i.due_at < CURRENT_DATE
            )
        )::int AS overdue,
        COUNT(*) FILTER (
          WHERE cancelled_at IS NULL
            AND (
              SELECT COUNT(*) FROM installments i
              WHERE i.plan_id = payment_plans.id AND i.status = 'paid'
            ) = installment_count
        )::int AS complete,
        COUNT(*) FILTER (WHERE cancelled_at IS NOT NULL)::int AS cancelled
      FROM payment_plans
    `);

    return (
      result.rows[0] ?? {
        total: 0,
        on_track: 0,
        overdue: 0,
        complete: 0,
        cancelled: 0,
      }
    );
  },
};

function applyPlanStatusFilter(
  q: Knex.QueryBuilder,
  status: string | undefined,
): void {
  const value = status?.trim() as PaymentPlanStatus | undefined;
  if (!value) {
    return;
  }

  if (value === "cancelled") {
    q.whereNotNull("payment_plans.cancelled_at");
    return;
  }

  q.whereNull("payment_plans.cancelled_at");

  if (value === "complete") {
    q.whereRaw(
      `(SELECT COUNT(*) FROM installments i WHERE i.plan_id = payment_plans.id AND i.status = 'paid') = payment_plans.installment_count`,
    );
    return;
  }

  if (value === "overdue") {
    q.whereExists(function existsOverdue() {
      this.select(db.raw("1"))
        .from("installments as i")
        .whereRaw("i.plan_id = payment_plans.id")
        .whereNotIn("i.status", ["paid", "cancelled"])
        .where("i.due_at", "<", db.raw("CURRENT_DATE"));
    });
    return;
  }

  if (value === "on_track") {
    q.whereRaw(
      `(SELECT COUNT(*) FROM installments i WHERE i.plan_id = payment_plans.id AND i.status = 'paid') < payment_plans.installment_count`,
    ).whereNotExists(function existsOverdue() {
      this.select(db.raw("1"))
        .from("installments as i")
        .whereRaw("i.plan_id = payment_plans.id")
        .whereNotIn("i.status", ["paid", "cancelled"])
        .where("i.due_at", "<", db.raw("CURRENT_DATE"));
    });
  }
}
