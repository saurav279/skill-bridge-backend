import Stripe from "stripe";
import { env } from "../config/env";
import { ConsultationModel } from "../models/consultation.model";
import { PackagePurchaseModel } from "../models/package-purchase.model";
import { AppError, ValidationError } from "../utils/errors";
import { createLeadId, createNoteId, createPackagePurchaseId, createPipelineId } from "../utils/id";
import { sendEmail } from "./email.service";
// import { stripePaymentSuccessToAdmin } from "../email-templates/stripe";
import { CalendarService, SLOT_WINDOW } from "./calendar.service";
import type { PackageName } from "../types/packages";
import { NoteModel } from "../models/note.model";
import { LeadModel } from "../models/lead.model";
import { formatSlotRange } from "../email-templates/consultation";
import { PipelineModel } from "../models/pipeline.model";
import {
  markInstallmentFailedFromStripe,
  markInstallmentPaidFromStripe,
} from "./installment-events";

const PACKAGE_PURCHASE_TYPE = "package-purchase";
const CALENDAR_CHECKOUT_TYPE = "stripe-calander";
export const INSTALLMENT_CHECKOUT_TYPE = "installment-payment";
const STRIPE_METADATA_MAX_LENGTH = 500;

export type CreateCheckoutSessionInput = {
  packageName: PackageName;
  successUrl: string;
  cancelUrl: string;
};

export type CreateCheckoutSessionResult = {
  sessionId: string;
  url: string;
};

export type CreateCalendarCheckoutInput = {
  startTime: Date | string;
  endTime: Date | string;
  name: string;
  email: string;
  phone: string;
  livesInUk: boolean;
  currentVisa?: string;
  description: string;
  packageName: PackageName;
  successUrl: string;
  cancelUrl: string;
};

export type CreateInstallmentCheckoutInput = {
  installmentId: string;
  planId: string;
  customerEmail: string;
  customerName: string;
  packageName: string;
  sequence: number;
  installmentCount: number;
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
};

export type CreateInstallmentCheckoutResult = CreateCheckoutSessionResult & {
  expiresAt: Date;
  paymentIntentId: string | null;
};

function getStripeClient(): Stripe {
  if (!env.stripe.secretKey) {
    throw new AppError(
      "Stripe is not configured. Set STRIPE_SECRET_KEY.",
      500,
    );
  }

  return new Stripe(env.stripe.secretKey);
}

function resolvePriceId(packageName: PackageName): string {
  const priceId = env.stripe.prices[packageName];
  if (!priceId) {
    throw new AppError(
      `Stripe price is not configured for package "${packageName}". Set STRIPE_PRICE_*_PRICE_ID.`,
      500,
    );
  }
  return priceId;
}

function metadataValue(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length > STRIPE_METADATA_MAX_LENGTH) {
    throw new ValidationError(
      `${field} must be at most ${STRIPE_METADATA_MAX_LENGTH} characters`,
    );
  }
  return trimmed;
}

// function withEmailQuery(url: string, email: string): string {
//   const parsed = new URL(url);
//   if (!parsed.searchParams.has("email")) {
//     parsed.searchParams.set("email", email);
//   }
//   return parsed.toString();
// }

export const StripeService = {
  getClient(): Stripe {
    return getStripeClient();
  },

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    const priceId = resolvePriceId(input.packageName);
    const stripe = getStripeClient();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,

      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        type: PACKAGE_PURCHASE_TYPE,
        packageName: input.packageName,
        // customerName: input.customerName,
        // customerEmail: input.customerEmail,
      },
    });

    if (!session.url) {
      throw new AppError("Stripe did not return a checkout URL", 500);
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  },

  async createCalendarCheckoutSession(
    input: CreateCalendarCheckoutInput,
  ): Promise<CreateCheckoutSessionResult> {
    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      throw new ValidationError("startTime and endTime must be valid ISO dates");
    }
    if (endTime <= startTime) {
      throw new ValidationError("End time must be after start time");
    }

    const booked = await CalendarService.isTimeSlotBooked(startTime, endTime);
    if (booked) {
      throw new ValidationError("This time slot is already booked");
    }

    const priceId = resolvePriceId(input.packageName);
    const stripe = getStripeClient();


    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      customer_email: input.email.trim(),
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      invoice_creation: {
        enabled: true,
      },
      // payment_method_configuration: env.stripe.allowKlarns[input.packageName] === "true"
      // ? "pmc_with_klarna"
      // : "pmc_without_klarna",

      metadata: {

        type: CALENDAR_CHECKOUT_TYPE,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        name: metadataValue(input.name, "name"),
        email: metadataValue(input.email, "email"),
        phone: metadataValue(input.phone, "phone"),
        livesInUk: input.livesInUk ? "true" : "false",
        ...(input.currentVisa
          ? { currentVisa: metadataValue(input.currentVisa, "currentVisa") }
          : {}),
        description: metadataValue(input.description, "description"),
        packageName: input.packageName,
      },
    });

    if (!session.url) {
      throw new AppError("Stripe did not return a checkout URL", 500);
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  },

  async createInstallmentCheckoutSession(
    input: CreateInstallmentCheckoutInput,
  ): Promise<CreateInstallmentCheckoutResult> {
    const stripe = getStripeClient();
    const packageLabel = input.packageName
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: input.customerEmail.trim(),
      line_items: [
        {
          price_data: {
            currency: input.currency,
            unit_amount: input.amount,
            product_data: {
              name: `${packageLabel} — installment ${input.sequence} of ${input.installmentCount}`,
            },
          },
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      invoice_creation: {
        enabled: true,
      },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        type: INSTALLMENT_CHECKOUT_TYPE,
        installmentId: input.installmentId,
        planId: input.planId,
        packageName: input.packageName,
        sequence: String(input.sequence),
        customerName: metadataValue(input.customerName, "customerName"),
      },
      payment_intent_data: {
        metadata: {
          type: INSTALLMENT_CHECKOUT_TYPE,
          installmentId: input.installmentId,
          planId: input.planId,
        },
      },
    });

    if (!session.url) {
      throw new AppError("Stripe did not return a checkout URL", 500);
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);

    return {
      sessionId: session.id,
      url: session.url,
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000)
        : new Date(Date.now() + 24 * 60 * 60 * 1000),
      paymentIntentId,
    };
  },

  constructEvent(
    rawBody: string | Buffer,
    signature: string | string[] | undefined,
  ): Stripe.Event {
    if (!env.stripe.webhookSecret) {
      throw new AppError(
        "Stripe webhook is not configured. Set STRIPE_WEBHOOK_SECRET.",
        500,
      );
    }

    const sig = Array.isArray(signature) ? signature[0] : signature;
    if (!sig) {
      throw new ValidationError("Missing Stripe-Signature header");
    }

    try {
      return getStripeClient().webhooks.constructEvent(
        rawBody,
        sig,
        env.stripe.webhookSecret,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "invalid signature";
      throw new ValidationError(
        `Webhook signature verification failed: ${message}`,
      );
    }
  },

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const type = session.metadata?.type;
        if (type === CALENDAR_CHECKOUT_TYPE) {
          await this.handleCalendarCheckoutCompleted(session);
        }
        if (type === INSTALLMENT_CHECKOUT_TYPE) {
          await markInstallmentPaidFromStripe(session);
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("Payment succeeded:", paymentIntent.id);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("Payment failed:", paymentIntent.id);
        if (paymentIntent.metadata?.type === INSTALLMENT_CHECKOUT_TYPE) {
          await markInstallmentFailedFromStripe(paymentIntent);
        }
        break;
      }

      default:
        console.log(`Unhandled event: ${event.type}`);
    }
  },



  async handleCalendarCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const existing = await ConsultationModel.findBySessionId(session.id);
    if (existing) {
      return;
    }

    const metadata = session.metadata ?? {};
    const startTime = metadata.startTime?.trim();
    const endTime = metadata.endTime?.trim();
    const name = metadata.name?.trim();
    const email = metadata.email?.trim();
    const description = metadata.description?.trim();
    const packageName = metadata.packageName?.trim();
    const phone = metadata.phone?.trim();
    const livesInUk = metadata.livesInUk === "true";
    const currentVisa = metadata.currentVisa?.trim() || undefined;

    if (
      !startTime ||
      !endTime ||
      !name ||
      !email ||
      !phone ||
      !description ||
      !packageName
    ) {
      console.error(
        "Calendar checkout metadata missing fields for session:",
        session.id,
        metadata,
      );
      return;
    }

    try {
      await CalendarService.addCalendar({
        startTime,
        endTime,
        name,
        email,
        phone,
        livesInUk,
        currentVisa,
        description,
        packageName,
        price: session.amount_total ?? 0,
        stripeSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null),
      });
      console.log("Calendar consultation booked and email sent: ", session.id);


      const customerName = name;
      const customerEmail = email;

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);

      await PackagePurchaseModel.create({
        id: createPackagePurchaseId(),
        customerName,
        customerEmail,
        customerPhone: phone ?? null,
        stripeSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        amount: session.amount_total ?? 0,
        currency: session.currency ?? "gbp",
        packageName,
      });

      const time = formatSlotRange(new Date(startTime), new Date(endTime), SLOT_WINDOW.timeZone)


      const lead = await LeadModel.create({
        id: createLeadId(),
        email: email,
        name: name,
        phone: phone,
        priority: "High",
      });
      if (lead.id) {
        await NoteModel.create({
          id: createNoteId(),
          leadId: lead.id,
          note: `Package Purchased: ${packageName} — booked for ${time}, with a total payment of £${session.amount_total}`,
          notedBy: "System",
        });
        await PipelineModel.create({
          id: createPipelineId(),
          leadId: lead.id,
          status: packageName + " Scheduled",
        });
      }




    } catch (error) {
      if (
        error instanceof ValidationError &&
        error.message === "This time slot is already booked"
      ) {
        console.error(
          "Calendar slot already booked after payment for session:",
          session.id,
        );
        return;
      }
      throw error;
    }
  },
};
