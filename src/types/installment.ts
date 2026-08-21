export const INSTALLMENT_STORED_STATUSES = [
  "upcoming",
  "link_sent",
  "paid",
  "failed",
  "cancelled",
] as const;

export type InstallmentStoredStatus = (typeof INSTALLMENT_STORED_STATUSES)[number];

export const INSTALLMENT_STATUSES = [
  "upcoming",
  "due",
  "link_sent",
  "paid",
  "failed",
  "overdue",
  "cancelled",
] as const;

export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export const PAYMENT_PLAN_STATUSES = [
  "on_track",
  "overdue",
  "complete",
  "cancelled",
] as const;

export type PaymentPlanStatus = (typeof PAYMENT_PLAN_STATUSES)[number];

export const INSTALLMENT_STATUS_SQL = `
  CASE
    WHEN installments.status = 'paid' THEN 'paid'
    WHEN installments.status = 'cancelled' THEN 'cancelled'
    WHEN installments.due_at < CURRENT_DATE THEN 'overdue'
    WHEN installments.status = 'failed' THEN 'failed'
    WHEN installments.status = 'link_sent' THEN 'link_sent'
    WHEN installments.due_at <= CURRENT_DATE + INTERVAL '7 days' THEN 'due'
    ELSE 'upcoming'
  END
`;
