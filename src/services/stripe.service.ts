import Stripe from "stripe";
import { env } from "../config/env";
import { PackagePurchaseModel } from "../models/package-purchase.model";
import { AppError, ValidationError } from "../utils/errors";
import { createPackagePurchaseId } from "../utils/id";
import { sendEmail } from "./email.service";
import { packagePurchasedEmailTemplateToAdmin } from "../controllers/emails.controller";

export type StripePackageName = "A" | "B" | "C";

const PACKAGE_PURCHASE_TYPE = "package-purchase";

export type CreateCheckoutSessionInput = {
  packageName: StripePackageName;
  // customerName: string;
  // customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export type CreateCheckoutSessionResult = {
  sessionId: string;
  url: string;
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

function resolvePriceId(packageName: StripePackageName): string {
  const priceId = env.stripe.prices[packageName];
  if (!priceId) {
    throw new AppError(
      `Stripe price is not configured for package "${packageName}". Set STRIPE_PRICE_${packageName}.`,
      500,
    );
  }
  return priceId;
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
        await this.handlePackagePurchaseCompleted(session);
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
      subject: "Package purchased",
      body: packagePurchasedEmailTemplateToAdmin({ customerName, customerEmail, packageName, packagePrice: session.amount_total ?? 0 }),
    });

    console.log("Package purchase saved:", session.id);
  },
};
