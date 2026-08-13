import { env } from "../config/env";
import {
  btnLink,
  escapeHtml,
  heading,
  labeledValue,
  paragraph,
  section,
  textContent,
} from "./helpers";

export type ConsultationEmailInput = {
  name: string;
  email: string;
  description: string;
  packageName: string;
  price: number;
  startTime: Date;
  endTime: Date;
  timeZone: string;
  htmlLink?: string;
};

function formatUkDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function formatSlotRange(
  startTime: Date,
  endTime: Date,
  timeZone: string,
): string {
  const datePart = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(startTime);

  const timeFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return `${datePart}, ${timeFormat.format(startTime)} – ${timeFormat.format(endTime)} (${timeZone})`;
}

function formatAmount(price: number): string {
  return `£${(price / 100).toFixed(2)}`;
}

function descriptionBlock(description: string): string {
  const safe = escapeHtml(description.trim() || "-").replaceAll("\n", "<br>");
  return `<p>${safe}</p>`;
}

export function consultationThankYouToUser(
  input: ConsultationEmailInput,
): string {
  const name = input.name.trim() || "there";
  const assessmentUrl = `${env.frontendUrl}/assessment`;
  const slot = formatSlotRange(input.startTime, input.endTime, input.timeZone);

  return `
  ${heading("Thank you for booking")}
  ${paragraph(`Hi ${name},`)}
  ${paragraph(
    "Thank you for booking a consultation with Skill Bridge. Your appointment is confirmed.",
  )}

  ${section(
    "Your booking",
    `
    ${labeledValue("When", slot)}
    ${labeledValue("Package", input.packageName)}
    `,
  )}

  ${paragraph(
    "Before the call, please complete a short assessment. It helps us understand your background so we can make the conversation more useful.",
  )}
  ${btnLink(assessmentUrl, "Complete your assessment", "primary")}

  ${input.htmlLink ? btnLink(input.htmlLink, "View calendar event", "link") : ""}

  ${textContent.contact()}
  `;
}

export function consultationNotificationToAdmin(
  input: ConsultationEmailInput,
): string {
  const name = input.name.trim() || "Unknown";
  const email = input.email.trim() || "unknown";
  const slot = formatSlotRange(input.startTime, input.endTime, input.timeZone);

  return `
  ${heading("New consultation booked")}
  ${paragraph("Hi Admin,")}
  ${paragraph("Someone booked a Skill Bridge consultation. Details below:")}

  ${section(
    "Consultation details",
    `
    ${labeledValue("Name", name)}
    ${labeledValue("Email", email)}
    ${labeledValue("When", slot)}
    ${labeledValue("Starts", formatUkDateTime(input.startTime, input.timeZone))}
    ${labeledValue("Ends", formatUkDateTime(input.endTime, input.timeZone))}
    ${labeledValue("Package", input.packageName)}
    ${labeledValue("Amount paid", formatAmount(input.price))}
    `,
  )}

  ${section("Description", descriptionBlock(input.description))}

  ${btnLink(`mailto:${email}`, "Email customer", "primary")}
  ${input.htmlLink ? btnLink(input.htmlLink, "Open calendar event", "link") : ""}

  ${paragraph("This is an automated notification from Skill Bridge.")}
  `;
}
