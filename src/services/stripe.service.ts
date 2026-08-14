import Stripe from "stripe";
import { env } from "../config/env";
import { ConsultationModel } from "../models/consultation.model";
import { PackagePurchaseModel } from "../models/package-purchase.model";
import { AppError, ValidationError } from "../utils/errors";
import { createPackagePurchaseId } from "../utils/id";
import { sendEmail } from "./email.service";
import { stripePaymentSuccessToAdmin } from "../email-templates/stripe";
import { CalendarService } from "./calendar.service";
import type { PackageName } from "../types/packages";

const PACKAGE_PURCHASE_TYPE = "package-purchase";
const CALENDAR_CHECKOUT_TYPE = "stripe-calander";
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
        } else {
          await this.handlePackagePurchaseCompleted(session);
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
        break;
      }

      default:
        console.log(`Unhandled event: ${event.type}`);
    }
  },

  async handlePackagePurchaseCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {

    const metadata = session.metadata ?? {};
    if (metadata.type !== PACKAGE_PURCHASE_TYPE) {
      return;
    }
    const customerName = session.customer_details?.name?.trim() ?? "-";
    const customerEmail =
      session.customer_details?.email?.trim() ||
      session.customer_email?.trim() ||
      "-";

    const existing = await PackagePurchaseModel.findBySessionId(session.id);
    if (existing) {
      return;
    }

    // const customerName = metadata.customerName?.trim();
    // const customerEmail = metadata.customerEmail?.trim();
    const packageName = metadata.packageName?.trim();

    if (!customerName || !customerEmail || !packageName) {
      console.error(
        "Package purchase metadata missing fields for session:",
        session.id,
        metadata,
      );
      return;
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);

    await PackagePurchaseModel.create({
      id: createPackagePurchaseId(),
      customerName,
      customerEmail,
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      amount: session.amount_total ?? 0,
      currency: session.currency ?? "gbp",
      packageName,
    });

    await sendEmail({
      to: env.admin.email,
      subject: `Package purchased: ${packageName}`,
      body: stripePaymentSuccessToAdmin({
        customerName,
        customerEmail,
        packageName,
        packagePrice: session.amount_total ?? 0,
        currency: session.currency ?? "gbp",
      }),
    });

    console.log("Package purchase saved:", session.id);
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
      console.log("Calendar consultation booked:", session.id);
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
