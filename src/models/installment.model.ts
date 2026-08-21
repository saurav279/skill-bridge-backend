import { db } from "../db/knex";
import type { AdminListQuery } from "../types/admin";
import {
  INSTALLMENT_STATUS_SQL,
  type InstallmentStoredStatus,
} from "../types/installment";

export type InstallmentRow = {
  id: string;
  plan_id: string;
  sequence: number;
  amount: number;
  due_at: Date | string;
  status: InstallmentStoredStatus;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_checkout_url: string | null;
  checkout_expires_at: Date | string | null;
  link_sent_at: Date | string | null;
  paid_at: Date | string | null;
  failed_at: Date | string | null;
  paid_offline: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

export type InstallmentListRow = InstallmentRow & {
  computed_status: string;
  user_id: string;
  user_lead_id: string | null;
  user_name: string;
  user_email: string;
  user_phone: string | null;
  package_name: string;
  total_amount: number;
  currency: string;
  installment_count: number;
  paid_amount: string | number;
};

export type CreateInstallmentInput = {
  id: string;
  planId: string;
  sequence: number;
  amount: number;
  dueAt: string;
};

export type UpdateInstallmentInput = {
  amount?: number;
  dueAt?: string;
  status?: InstallmentStoredStatus;
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeCheckoutUrl?: string | null;
  checkoutExpiresAt?: Date | string | null;
  linkSentAt?: Date | string | null;
  paidAt?: Date | string | null;
  failedAt?: Date | string | null;
  paidOffline?: boolean;
};

export type InstallmentStatusCountsRow = {
  total: number;
  upcoming: number;
  due: number;
  link_sent: number;
  paid: number;
  failed: number;
  overdue: number;
};

const TABLE = "installments";

export const InstallmentModel = {
  async createMany(inputs: CreateInstallmentInput[]): Promise<InstallmentRow[]> {
    if (inputs.length === 0) {
      return [];
    }

    return db<InstallmentRow>(TABLE)
      .insert(
        inputs.map((input) => ({
          id: input.id,
          plan_id: input.planId,
          sequence: input.sequence,
          amount: input.amount,
          due_at: input.dueAt,
          status: "upcoming" as const,
          paid_offline: false,
        })),
      )
      .returning("*");
  },

  async findById(id: string): Promise<InstallmentRow | undefined> {
    return db<InstallmentRow>(TABLE).where({ id }).first();
  },

  async findBySessionId(stripeSessionId: string): Promise<InstallmentRow | undefined> {
    return db<InstallmentRow>(TABLE)
      .where({ stripe_session_id: stripeSessionId })
      .first();
  },

  async findByPaymentIntentId(
    stripePaymentIntentId: string,
  ): Promise<InstallmentRow | undefined> {
    return db<InstallmentRow>(TABLE)
      .where({ stripe_payment_intent_id: stripePaymentIntentId })
      .first();
  },

  async listByPlanId(planId: string): Promise<InstallmentRow[]> {
    return db<InstallmentRow>(TABLE)
      .where({ plan_id: planId })
      .orderBy("sequence", "asc");
  },

  async update(
    id: string,
    input: UpdateInstallmentInput,
  ): Promise<InstallmentRow | undefined> {
    const patch: Record<string, unknown> = {
      updated_at: db.fn.now(),
    };

    if (input.amount !== undefined) {
      patch.amount = input.amount;
    }
    if (input.dueAt !== undefined) {
      patch.due_at = input.dueAt;
    }
    if (input.status !== undefined) {
      patch.status = input.status;
    }
    if (input.stripeSessionId !== undefined) {
      patch.stripe_session_id = input.stripeSessionId;
    }
    if (input.stripePaymentIntentId !== undefined) {
      patch.stripe_payment_intent_id = input.stripePaymentIntentId;
    }
    if (input.stripeCheckoutUrl !== undefined) {
      patch.stripe_checkout_url = input.stripeCheckoutUrl;
    }
    if (input.checkoutExpiresAt !== undefined) {
      patch.checkout_expires_at = input.checkoutExpiresAt;
    }
    if (input.linkSentAt !== undefined) {
      patch.link_sent_at = input.linkSentAt;
    }
    if (input.paidAt !== undefined) {
      patch.paid_at = input.paidAt;
    }
    if (input.failedAt !== undefined) {
      patch.failed_at = input.failedAt;
    }
    if (input.paidOffline !== undefined) {
      patch.paid_offline = input.paidOffline;
    }

    const [row] = await db<InstallmentRow>(TABLE)
      .where({ id })
      .update(patch)
      .returning("*");
    return row;
  },

  async cancelUnpaidByPlanId(planId: string): Promise<number> {
    return db<InstallmentRow>(TABLE)
      .where({ plan_id: planId })
      .whereNotIn("status", ["paid", "cancelled"])
      .update({
        status: "cancelled",
        updated_at: db.fn.now() as unknown as Date,
      });
  },

  async listForAdmin(
    query: AdminListQuery,
  ): Promise<{ rows: InstallmentListRow[]; total: number }> {
    const q = db(TABLE)
      .join("payment_plans", "payment_plans.id", "installments.plan_id")
      .join("users", "users.id", "payment_plans.user_id")
      .select("installments.*");

    applyInstallmentFilters(q, query);

    const countRow = await q
      .clone()
      .clearSelect()
      .clearOrder()
      .count<{ count: string }>("installments.id as count")
      .first();

    const paidAmount = db("installments as paid_i")
      .sum("paid_i.amount")
      .whereRaw("paid_i.plan_id = payment_plans.id")
      .where("paid_i.status", "paid");

    const rows = await q
      .clone()
      .select(
        db.raw(`${INSTALLMENT_STATUS_SQL} as computed_status`),
        "payment_plans.user_id",
        "users.lead_id as user_lead_id",
        "users.name as user_name",
        "users.email as user_email",
        "users.phone as user_phone",
        "payment_plans.package_name",
        "payment_plans.total_amount",
        "payment_plans.currency",
        "payment_plans.installment_count",
        paidAmount.as("paid_amount"),
      )
      .orderBy("installments.due_at", query.order)
      .orderBy("installments.sequence", "asc")
      .offset((query.page - 1) * query.limit)
      .limit(query.limit);

    return { rows: rows as InstallmentListRow[], total: Number(countRow?.count ?? 0) };
  },

  async statusCounts(): Promise<InstallmentStatusCountsRow> {
    const result = await db.raw<{ rows: InstallmentStatusCountsRow[] }>(`
      SELECT
        COUNT(*) FILTER (WHERE computed_status != 'cancelled')::int AS total,
        COUNT(*) FILTER (WHERE computed_status = 'upcoming')::int AS upcoming,
        COUNT(*) FILTER (WHERE computed_status = 'due')::int AS due,
        COUNT(*) FILTER (WHERE computed_status = 'link_sent')::int AS link_sent,
        COUNT(*) FILTER (WHERE computed_status = 'paid')::int AS paid,
        COUNT(*) FILTER (WHERE computed_status = 'failed')::int AS failed,
        COUNT(*) FILTER (WHERE computed_status = 'overdue')::int AS overdue
      FROM (
        SELECT ${INSTALLMENT_STATUS_SQL} AS computed_status
        FROM installments
      ) counted
    `);

    return (
      result.rows[0] ?? {
        total: 0,
        upcoming: 0,
        due: 0,
        link_sent: 0,
        paid: 0,
        failed: 0,
        overdue: 0,
      }
    );
  },
};

function applyInstallmentFilters(
  q: ReturnType<typeof db>,
  query: AdminListQuery,
): void {
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
    q.where("installments.due_at", ">=", query.from);
  }
  if (query.to?.trim()) {
    q.where("installments.due_at", "<=", query.to);
  }
  if (query.leadId?.trim()) {
    q.where("users.lead_id", query.leadId.trim());
  }
  if (query.userId?.trim()) {
    q.where("payment_plans.user_id", query.userId.trim());
  }
  if (query.planId?.trim()) {
    q.where("installments.plan_id", query.planId.trim());
  }
  if (query.status?.trim()) {
    q.whereRaw(`(${INSTALLMENT_STATUS_SQL}) = ?`, [query.status.trim()]);
  }
}
