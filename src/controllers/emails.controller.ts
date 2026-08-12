import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { UnsubscribeService } from "../services/unsubscribe.service";

const emailBodySchema = z.object({
  email: z.string().email(),
});

export const EmailsController = {
  async unsubscribe(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = emailBodySchema.parse(req.body);
      const result = await UnsubscribeService.unsubscribeByEmail(email);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async subscribe(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = emailBodySchema.parse(req.body);
      const result = await UnsubscribeService.subscribeByEmail(email);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};

export function contactThankYouTemplate(input: { name: string }): string {
  const name = input.name.trim() || "there";

  return [
    `Hi ${name},`,
    "",
    "Thank you for contacting Skill Bridge.",
    "",
    "We have received your message and will get back to you soon.",
    "",
    "— Skill Bridge",
  ].join("\n");
}

export const packagePurchasedEmailTemplateToAdmin = (input: {
  customerName: string;
  customerEmail: string;
  packageName: string;
  packagePrice: number;
}): string => {
  const customerName = input.customerName.trim() || "there";
  const packageName = input.packageName.trim() || "package";
  const packagePrice = input.packagePrice.toFixed(2);
  const customerEmail = input.customerEmail.trim() || "unknown";

  return [
    `Hi Admin,`,
    "",
    `${customerName} (${customerEmail}) has purchased Package ${packageName} for £${packagePrice}.`,
    "",
    "— Skill Bridge",
  ].join("\n");
};
