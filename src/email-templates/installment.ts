import {
  btnLink,
  heading,
  labeledValue,
  paragraph,
} from "./helpers";
import { sanitizePackageName } from "../types/packages";
import type { PackageName } from "../types/packages";

export type InstallmentEmailInput = {
  customerName: string;
  packageName: string;
  sequence: number;
  installmentCount: number;
  amount: number;
  currency: string;
  dueAt: string;
  checkoutUrl: string;
};

function formatAmount(amount: number, currency: string): string {
  const value = (amount / 100).toFixed(2);
  if (currency.toLowerCase() === "gbp") {
    return `£${value}`;
  }
  return `${value} ${currency.toUpperCase()}`;
}

function formatDueDate(dueAt: string): string {
  const date = new Date(`${dueAt}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function installmentCheckoutToCustomer(input: InstallmentEmailInput): string {
  const name = input.customerName.trim() || "there";
  const packageLabel = sanitizePackageName(input.packageName as PackageName);
  const amount = formatAmount(input.amount, input.currency);
  const due = formatDueDate(input.dueAt);

  return `
    ${heading(`Installment ${input.sequence} of ${input.installmentCount}`)}
    ${paragraph(`Hi ${name},`)}
    ${paragraph(
      `Please pay installment ${input.sequence} of ${input.installmentCount} for your ${packageLabel} package.`,
    )}
    ${labeledValue("Amount due", amount)}
    ${labeledValue("Due date", due)}
    ${btnLink(input.checkoutUrl, "Pay now")}
    ${paragraph(
      "This checkout link expires in 24 hours. If it expires, contact us and we will send a new one.",
    )}
  `;
}
