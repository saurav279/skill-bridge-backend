import { env } from "../config/env";
import { UnsubscribeModel } from "../models/unsubscribe.model";
import { createUnsubscribeId } from "../utils/id";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function buildUnsubscribeUrl(email: string): string {
  const normalized = normalizeEmail(email);
  return `${env.frontendUrl}/unsubscribe?email=${encodeURIComponent(normalized)}`;
}

export const UnsubscribeService = {
  async unsubscribeByEmail(email: string): Promise<{
    message: string;
    action: "unsubscribe";
    email: string;
  }> {
    const normalized = normalizeEmail(email);
    await UnsubscribeModel.create({
      id: createUnsubscribeId(),
      email: normalized,
    });
    return {
      message: "Email unsubscribed successfully.",
      action: "unsubscribe",
      email: normalized,
    };
  },

  async subscribeByEmail(email: string): Promise<{
    message: string;
    action: "subscribe";
    email: string;
  }> {
    const normalized = normalizeEmail(email);
    await UnsubscribeModel.deleteByEmail(normalized);
    return {
      message: "Email subscribed successfully.",
      action: "subscribe",
      email: normalized,
    };
  },

  async isUnsubscribed(email: string): Promise<boolean> {
    const row = await UnsubscribeModel.findByEmail(normalizeEmail(email));
    return Boolean(row);
  },
};
