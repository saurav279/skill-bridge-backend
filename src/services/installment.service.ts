import { env } from "../config/env";
import { installmentCheckoutToCustomer } from "../email-templates/installment";
import { LeadModel } from "../models/lead.model";
import {
  InstallmentModel,
  type InstallmentListRow,
  type InstallmentRow,
} from "../models/installment.model";
import { NoteModel } from "../models/note.model";
import {
  PaymentPlanModel,
  type PaymentPlanListRow,
  type PaymentPlanRow,
} from "../models/payment-plan.model";
import { UserModel, type UserRow } from "../models/user.model";
import type { AdminListQuery, AdminListResponse } from "../types/admin";
import type {
  InstallmentStatus,
  PaymentPlanStatus,
} from "../types/installment";
import { sanitizePackageName } from "../types/packages";
import type { PackageName } from "../types/packages";
import { NotFoundError, ValidationError } from "../utils/errors";
import {
  createInstallmentId,
  createNoteId,
  createPaymentPlanId,
} from "../utils/id";
import { queueEmail } from "../queues/email.queue";
import { StripeService } from "./stripe.service";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export type CreatePaymentPlanBody = {
  userId: string;
  packageName: PackageName;
  totalAmount: number;
  currency?: string;
  installmentCount?: number;
  intervalDays?: number;
  firstDueAt: string;
  installments?: Array<{ amount: number; dueAt: string }>;
};

export type CreateCheckoutBody = {
  successUrl?: string;
  cancelUrl?: string;
};

export type UpdateInstallmentBody = {
  amount?: number;
  dueAt?: string;
  paidOffline?: boolean;
};

export type InstallmentItem = {
  id: string;
  planId: string;
  userId: string;
  leadId: string | null;
  sequence: number;
  installmentCount: number;
  amount: number;
  currency: string;
  dueAt: string;
  status: InstallmentStatus;
  checkoutUrl: string | null;
  checkoutExpiresAt: string | null;
  linkSentAt: string | null;
  paidAt: string | null;
  failedAt: string | null;
  paidOffline: boolean;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  packageName: string;
  totalAmount: number;
  paidAmount: number;
  createdAt: string;
  updatedAt: string;
};

export type PaymentPlanListItem = {
  id: string;
  userId: string;
  leadId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  packageName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  currency: string;
  installmentCount: number;
  paidCount: number;
  intervalDays: number;
  firstDueAt: string;
  nextDueAt: string | null;
  status: PaymentPlanStatus;
  createdAt: string;
  updatedAt: string;
};

export type PaymentPlanDetail = PaymentPlanListItem & {
  installments: InstallmentItem[];
};

export type PaymentPlanStatusCounts = {
  total: number;
  onTrack: number;
  overdue: number;
  complete: number;
  cancelled: number;
};

export type InstallmentStatusCounts = {
  total: number;
  upcoming: number;
  due: number;
  linkSent: number;
  paid: number;
  failed: number;
  overdue: number;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  return toIso(value);
}

function toDateOnly(value: Date | string): string {
  if (typeof value === "string") {
    const isoDate = value.slice(0, 10);
    if (DATE_ONLY.test(isoDate)) {
      return isoDate;
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateOnlyOrNull(value: Date | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  return toDateOnly(value);
}

function paginated<T>(
  data: T[],
  total: number,
  query: AdminListQuery,
): AdminListResponse<T> {
  return {
    data,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
  };
}

function formatPounds(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
}

function addDaysDateOnly(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const nextYear = utc.getUTCFullYear();
  const nextMonth = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(utc.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}



function splitAmounts(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? base + remainder : base,
  );
}

function computeInstallmentStatus(row: InstallmentRow, now = new Date()): InstallmentStatus {
  if (row.status === "paid") {
    return "paid";
  }
  if (row.status === "cancelled") {
    return "cancelled";
  }
  const due = toDateOnly(row.due_at);
  const today = toDateOnly(now);
  if (due < today) {
    return "overdue";
  }
  if (row.status === "failed") {
    return "failed";
  }
  if (row.status === "link_sent") {
    return "link_sent";
  }
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (due <= toDateOnly(weekAhead)) {
    return "due";
  }
  return "upcoming";
}

function computePlanStatus(
  plan: PaymentPlanRow,
  paidCount: number,
  nextDueAt: Date | string | null,
): PaymentPlanStatus {
  if (plan.cancelled_at) {
    return "cancelled";
  }
  if (paidCount >= plan.installment_count) {
    return "complete";
  }
  if (nextDueAt && toDateOnly(nextDueAt) < toDateOnly(new Date())) {
    return "overdue";
  }
  return "on_track";
}

function isCheckoutExpired(expiresAt: Date | string | null): boolean {
  if (!expiresAt) {
    return true;
  }
  const time =
    expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  return Number.isNaN(time) || time <= Date.now();
}

function defaultCheckoutUrls(): { successUrl: string; cancelUrl: string } {
  return {
    successUrl: `${env.frontendUrl}/installments/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${env.frontendUrl}/installments/cancel`,
  };
}

function mapInstallment(
  row: InstallmentRow,
  plan: PaymentPlanRow,
  user: UserRow,
  paidAmount: number,
): InstallmentItem {
  return {
    id: row.id,
    planId: row.plan_id,
    userId: user.id,
    leadId: user.lead_id,
    sequence: row.sequence,
    installmentCount: plan.installment_count,
    amount: row.amount,
    currency: plan.currency,
    dueAt: toDateOnly(row.due_at),
    status: computeInstallmentStatus(row),
    checkoutUrl: row.stripe_checkout_url,
    checkoutExpiresAt: toIsoOrNull(row.checkout_expires_at),
    linkSentAt: toIsoOrNull(row.link_sent_at),
    paidAt: toIsoOrNull(row.paid_at),
    failedAt: toIsoOrNull(row.failed_at),
    paidOffline: row.paid_offline,
    stripeSessionId: row.stripe_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    customerName: user.name,
    customerEmail: user.email,
    customerPhone: user.phone,
    packageName: plan.package_name,
    totalAmount: plan.total_amount,
    paidAmount,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapInstallmentListItem(row: InstallmentListRow): InstallmentItem {
  const paidAmount = Number(row.paid_amount ?? 0);
  const plan: PaymentPlanRow = {
    id: row.plan_id,
    user_id: row.user_id,
    package_name: row.package_name,
    total_amount: row.total_amount,
    currency: row.currency,
    installment_count: row.installment_count,
    interval_days: 0,
    first_due_at: row.due_at,
    cancelled_at: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  const user: UserRow = {
    id: row.user_id,
    name: row.user_name,
    email: row.user_email,
    phone: row.user_phone,
    lead_id: row.user_lead_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  const mapped = mapInstallment(row, plan, user, paidAmount);
  mapped.status = row.computed_status as InstallmentStatus;
  return mapped;
}

function mapPlanListItem(row: PaymentPlanListRow): PaymentPlanListItem {
  const paidAmount = Number(row.paid_amount ?? 0);
  const paidCount = Number(row.paid_count ?? 0);
  return {
    id: row.id,
    userId: row.user_id,
    leadId: row.user_lead_id,
    customerName: row.user_name,
    customerEmail: row.user_email,
    customerPhone: row.user_phone,
    packageName: row.package_name,
    totalAmount: row.total_amount,
    paidAmount,
    remainingAmount: Math.max(row.total_amount - paidAmount, 0),
    currency: row.currency,
    installmentCount: row.installment_count,
    paidCount,
    intervalDays: row.interval_days,
    firstDueAt: toDateOnly(row.first_due_at),
    nextDueAt: toDateOnlyOrNull(row.next_due_at),
    status: computePlanStatus(row, paidCount, row.next_due_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function planFromInstallments(
  plan: PaymentPlanRow,
  user: UserRow,
  installments: InstallmentRow[],
): PaymentPlanDetail {
  const paidRows = installments.filter((row) => row.status === "paid");
  const paidAmount = paidRows.reduce((sum, row) => sum + row.amount, 0);
  const unpaid = installments
    .filter((row) => row.status !== "paid" && row.status !== "cancelled")
    .sort((a, b) => toDateOnly(a.due_at).localeCompare(toDateOnly(b.due_at)));
  const nextDueAt = unpaid[0]?.due_at ?? null;
  const listRow: PaymentPlanListRow = {
    ...plan,
    paid_amount: paidAmount,
    paid_count: paidRows.length,
    next_due_at: nextDueAt,
    user_name: user.name,
    user_email: user.email,
    user_phone: user.phone,
    user_lead_id: user.lead_id,
  };

  return {
    ...mapPlanListItem(listRow),
    installments: installments.map((row) => mapInstallment(row, plan, user, paidAmount)),
  };
}

async function addLeadNote(leadId: string | null, note: string): Promise<void> {
  if (!leadId) {
    return;
  }
  const lead = await LeadModel.findById(leadId);
  if (!lead) {
    return;
  }
  await NoteModel.create({
    id: createNoteId(),
    leadId,
    note,
    notedBy: "System",
  });
}

async function requireUser(id: string): Promise<UserRow> {
  const user = await UserModel.findById(id);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  return user;
}

async function requirePlan(id: string): Promise<PaymentPlanRow> {
  const plan = await PaymentPlanModel.findById(id);
  if (!plan) {
    throw new NotFoundError("Payment plan not found");
  }
  return plan;
}

async function requireInstallment(id: string): Promise<InstallmentRow> {
  const row = await InstallmentModel.findById(id);
  if (!row) {
    throw new NotFoundError("Installment not found");
  }
  return row;
}

async function buildPlanDetail(plan: PaymentPlanRow): Promise<PaymentPlanDetail> {
  const user = await requireUser(plan.user_id);
  const installments = await InstallmentModel.listByPlanId(plan.id);
  return planFromInstallments(plan, user, installments);
}

async function buildInstallmentItem(row: InstallmentRow): Promise<InstallmentItem> {
  const plan = await requirePlan(row.plan_id);
  const user = await requireUser(plan.user_id);
  const siblings = await InstallmentModel.listByPlanId(plan.id);
  const paidAmount = siblings
    .filter((item) => item.status === "paid")
    .reduce((sum, item) => sum + item.amount, 0);
  return mapInstallment(row, plan, user, paidAmount);
}

function packageLabel(packageName: string): string {
  return sanitizePackageName(packageName as PackageName);
}

export const InstallmentService = {
  async createPlan(body: CreatePaymentPlanBody): Promise<PaymentPlanDetail> {
    const installmentCount = body.installmentCount ?? 4;
    const intervalDays = body.intervalDays ?? 60;
    const currency = (body.currency ?? "gbp").toLowerCase();
    const firstDueAt = body.firstDueAt.trim();

    if (!DATE_ONLY.test(firstDueAt)) {
      throw new ValidationError("firstDueAt must be YYYY-MM-DD");
    }

    const user = await UserModel.findById(body.userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    let schedule: Array<{ amount: number; dueAt: string }>;
    if (body.installments?.length) {
      if (body.installments.length !== installmentCount) {
        throw new ValidationError(
          "installments length must match installmentCount",
        );
      }
      const sum = body.installments.reduce((total, row) => total + row.amount, 0);
      if (sum !== body.totalAmount) {
        throw new ValidationError("installment amounts must sum to totalAmount");
      }
      for (const row of body.installments) {
        if (!DATE_ONLY.test(row.dueAt)) {
          throw new ValidationError("installment dueAt must be YYYY-MM-DD");
        }
      }
      schedule = body.installments.map((row) => ({
        amount: row.amount,
        dueAt: row.dueAt,
      }));
    } else {
      const amounts = splitAmounts(body.totalAmount, installmentCount);
      schedule = amounts.map((amount, index) => ({
        amount,
        dueAt: addDaysDateOnly(firstDueAt, index * intervalDays),
      }));
    }

    const plan = await PaymentPlanModel.create({
      id: createPaymentPlanId(),
      userId: user.id,
      packageName: body.packageName,
      totalAmount: body.totalAmount,
      currency,
      installmentCount,
      intervalDays,
      firstDueAt,
    });

    await InstallmentModel.createMany(
      schedule.map((row, index) => ({
        id: createInstallmentId(),
        planId: plan.id,
        sequence: index + 1,
        amount: row.amount,
        dueAt: row.dueAt,
      })),
    );

    await addLeadNote(
      user.lead_id,
      `Payment plan created: ${packageLabel(plan.package_name)} — ${installmentCount} installments, total ${formatPounds(plan.total_amount)}`,
    );

    return buildPlanDetail(plan);
  },

  async listPlans(
    query: AdminListQuery,
  ): Promise<AdminListResponse<PaymentPlanListItem>> {
    const { rows, total } = await PaymentPlanModel.listForAdmin(query);
    return paginated(rows.map(mapPlanListItem), total, query);
  },

  async getPlanStatusCounts(): Promise<PaymentPlanStatusCounts> {
    const row = await PaymentPlanModel.statusCounts();
    return {
      total: Number(row.total ?? 0),
      onTrack: Number(row.on_track ?? 0),
      overdue: Number(row.overdue ?? 0),
      complete: Number(row.complete ?? 0),
      cancelled: Number(row.cancelled ?? 0),
    };
  },

  async getPlanById(id: string): Promise<PaymentPlanDetail> {
    const plan = await requirePlan(id);
    return buildPlanDetail(plan);
  },

  async cancelPlan(id: string): Promise<PaymentPlanDetail> {
    const existing = await requirePlan(id);
    if (existing.cancelled_at) {
      throw new ValidationError("Payment plan is already cancelled");
    }

    const cancelled = await PaymentPlanModel.cancel(id);
    if (!cancelled) {
      throw new NotFoundError("Payment plan not found");
    }
    await InstallmentModel.cancelUnpaidByPlanId(id);
    const user = await requireUser(cancelled.user_id);
    await addLeadNote(
      user.lead_id,
      `Payment plan cancelled: ${packageLabel(cancelled.package_name)}`,
    );
    return buildPlanDetail(cancelled);
  },

  async list(query: AdminListQuery): Promise<AdminListResponse<InstallmentItem>> {
    const { rows, total } = await InstallmentModel.listForAdmin(query);
    return paginated(rows.map(mapInstallmentListItem), total, query);
  },

  async getStatusCounts(): Promise<InstallmentStatusCounts> {
    const row = await InstallmentModel.statusCounts();
    return {
      total: Number(row.total ?? 0),
      upcoming: Number(row.upcoming ?? 0),
      due: Number(row.due ?? 0),
      linkSent: Number(row.link_sent ?? 0),
      paid: Number(row.paid ?? 0),
      failed: Number(row.failed ?? 0),
      overdue: Number(row.overdue ?? 0),
    };
  },

  async getById(id: string): Promise<InstallmentItem> {
    const row = await requireInstallment(id);
    return buildInstallmentItem(row);
  },

  async createCheckout(
    id: string,
    body: CreateCheckoutBody,
  ): Promise<InstallmentItem> {
    const row = await requireInstallment(id);
    if (row.status === "paid") {
      throw new ValidationError("Installment is already paid");
    }
    if (row.status === "cancelled") {
      throw new ValidationError("Installment is cancelled");
    }

    const plan = await requirePlan(row.plan_id);
    const user = await requireUser(plan.user_id);
    if (plan.cancelled_at) {
      throw new ValidationError("Payment plan is cancelled");
    }

    if (row.stripe_checkout_url && !isCheckoutExpired(row.checkout_expires_at)) {
      return buildInstallmentItem(row);
    }

    const defaults = defaultCheckoutUrls();
    const checkout = await StripeService.createInstallmentCheckoutSession({
      installmentId: row.id,
      planId: plan.id,
      customerEmail: user.email,
      customerName: user.name,
      packageName: plan.package_name,
      sequence: row.sequence,
      installmentCount: plan.installment_count,
      amount: row.amount,
      currency: plan.currency,
      successUrl: body.successUrl ?? defaults.successUrl,
      cancelUrl: body.cancelUrl ?? defaults.cancelUrl,
    });

    const updated = await InstallmentModel.update(row.id, {
      status: "link_sent",
      stripeSessionId: checkout.sessionId,
      stripePaymentIntentId: checkout.paymentIntentId,
      stripeCheckoutUrl: checkout.url,
      checkoutExpiresAt: checkout.expiresAt,
    });
    if (!updated) {
      throw new NotFoundError("Installment not found");
    }
    await PaymentPlanModel.touch(plan.id);

    return buildInstallmentItem(updated);
  },

  async sendCheckoutEmail(
    id: string,
    body: CreateCheckoutBody,
  ): Promise<{ message: string; installment: InstallmentItem }> {
    const withCheckout = await this.createCheckout(id, body);
    if (!withCheckout.checkoutUrl) {
      throw new ValidationError("Checkout URL could not be created");
    }

    await queueEmail({
      to: withCheckout.customerEmail,
      subject: `Installment ${withCheckout.sequence} of ${withCheckout.installmentCount} — ${packageLabel(withCheckout.packageName)}`,
      body: installmentCheckoutToCustomer({
        customerName: withCheckout.customerName,
        packageName: withCheckout.packageName,
        sequence: withCheckout.sequence,
        installmentCount: withCheckout.installmentCount,
        amount: withCheckout.amount,
        currency: withCheckout.currency,
        dueAt: withCheckout.dueAt,
        checkoutUrl: withCheckout.checkoutUrl,
      }),
    });

    const updated = await InstallmentModel.update(id, {
      linkSentAt: new Date(),
    });
    await PaymentPlanModel.touch(withCheckout.planId);
    await addLeadNote(
      withCheckout.leadId,
      `Installment ${withCheckout.sequence}/${withCheckout.installmentCount} checkout link sent — ${formatPounds(withCheckout.amount)}`,
    );

    return {
      message: "Installment email sent.",
      installment: updated ? await buildInstallmentItem(updated) : withCheckout,
    };
  },

  async update(
    id: string,
    body: UpdateInstallmentBody,
  ): Promise<InstallmentItem> {
    const row = await requireInstallment(id);
    if (row.status === "cancelled") {
      throw new ValidationError("Installment is cancelled");
    }

    if (body.paidOffline) {
      if (row.status === "paid") {
        throw new ValidationError("Installment is already paid");
      }
      const updated = await InstallmentModel.update(id, {
        status: "paid",
        paidAt: new Date(),
        paidOffline: true,
      });
      if (!updated) {
        throw new NotFoundError("Installment not found");
      }
      const plan = await requirePlan(updated.plan_id);
      const user = await requireUser(plan.user_id);
      await PaymentPlanModel.touch(plan.id);
      await addLeadNote(
        user.lead_id,
        `Installment ${updated.sequence}/${plan.installment_count} marked paid offline — ${formatPounds(updated.amount)}`,
      );
      return buildInstallmentItem(updated);
    }

    if (row.status === "paid") {
      throw new ValidationError("Paid installments cannot be edited");
    }

    if (body.amount === undefined && body.dueAt === undefined) {
      throw new ValidationError("At least one field is required");
    }

    if (body.dueAt !== undefined && !DATE_ONLY.test(body.dueAt)) {
      throw new ValidationError("dueAt must be YYYY-MM-DD");
    }

    const updated = await InstallmentModel.update(id, {
      amount: body.amount,
      dueAt: body.dueAt,
    });
    if (!updated) {
      throw new NotFoundError("Installment not found");
    }

    if (body.amount !== undefined) {
      await PaymentPlanModel.refreshTotalAmount(updated.plan_id);
    } else {
      await PaymentPlanModel.touch(updated.plan_id);
    }

    return buildInstallmentItem(updated);
  },
};
