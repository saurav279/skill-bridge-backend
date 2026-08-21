import type Stripe from "stripe";
import { LeadModel } from "../models/lead.model";
import { InstallmentModel } from "../models/installment.model";
import { NoteModel } from "../models/note.model";
import { PaymentPlanModel } from "../models/payment-plan.model";
import { UserModel } from "../models/user.model";
import { createNoteId } from "../utils/id";

function formatPounds(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
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

export async function markInstallmentPaidFromStripe(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const installmentId = session.metadata?.installmentId?.trim();
  const row =
    (installmentId ? await InstallmentModel.findById(installmentId) : undefined) ??
    (await InstallmentModel.findBySessionId(session.id));

  if (!row) {
    console.error("Installment checkout completed but row not found:", session.id);
    return;
  }
  if (row.status === "paid") {
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? row.stripe_payment_intent_id);

  const updated = await InstallmentModel.update(row.id, {
    status: "paid",
    paidAt: new Date(),
    stripeSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
  });
  if (!updated) {
    return;
  }

  const plan = await PaymentPlanModel.findById(updated.plan_id);

  if (plan) {
    await PaymentPlanModel.touch(plan.id);
    const user = await UserModel.findById(plan.user_id);
 
    await addLeadNote(
      user?.lead_id ?? null,
      `Installment ${updated.sequence}/${plan.installment_count} paid — ${formatPounds(updated.amount)}`,
    );
  }

  console.log("Installment paid:", updated.id, session.id);
}

export async function markInstallmentFailedFromStripe(
  paymentIntent: Stripe.PaymentIntent,
): Promise<void> {
  const installmentId = paymentIntent.metadata?.installmentId?.trim();
  const row =
    (installmentId ? await InstallmentModel.findById(installmentId) : undefined) ??
    (await InstallmentModel.findByPaymentIntentId(paymentIntent.id));

  if (!row || row.status === "paid" || row.status === "cancelled") {
    return;
  }

  const updated = await InstallmentModel.update(row.id, {
    status: "failed",
    failedAt: new Date(),
    stripePaymentIntentId: paymentIntent.id,
  });
  if (!updated) {
    return;
  }

  const plan = await PaymentPlanModel.findById(updated.plan_id);
  if (plan) {
    await PaymentPlanModel.touch(plan.id);
    const user = await UserModel.findById(plan.user_id);
    await addLeadNote(
      user?.lead_id ?? null,
      `Installment ${updated.sequence}/${plan.installment_count} payment failed — ${formatPounds(updated.amount)}`,
    );
  }
}
