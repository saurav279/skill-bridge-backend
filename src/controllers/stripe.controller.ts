import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { StripeService } from "../services/stripe.service";
import { PACKAGE_NAMES } from "../types/packages";

const createCheckoutSchema = z.object({
  packageName: z.enum(PACKAGE_NAMES),
  // customerName: z.string().min(1),
  // customerEmail: z.string().email(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const StripeController = {
  async createCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createCheckoutSchema.parse(req.body);
      const { url } = await StripeService.createCheckoutSession({ packageName: body.packageName, successUrl: body.successUrl, cancelUrl: body.cancelUrl });
      res.status(201).json({ url });
    } catch (error) {
      next(error);
    }
  },

  async webhook(req: Request, res: Response, next: NextFunction) {
    try {
      const event = StripeService.constructEvent(
        req.body,
        req.headers["stripe-signature"],
      );
      await StripeService.handleEvent(event);
      res.status(200).json({ received: true });
    } catch (error) {
      next(error);
    }
  },
};
