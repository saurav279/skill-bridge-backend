import { env } from "../config/env";
import { formatCurrentVisa, formatLivesInUk } from "../utils/intake";
import {
  btnLink,
  escapeHtml,
  getAssessmentBtnFromEmail,
  heading,
  labeledValue,
  paragraph,
  section,
  textContent,
} from "./helpers";

export type ConsultationEmailInput = {
  name: string;
  email: string;
  phone: string;
  livesInUk: boolean;
  currentVisa?: string | null;
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

export function formatSlotRange(
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
  ${heading(`Thank you for purchasing a Package ${input.packageName} and initial call`) }
  ${paragraph(`Hi ${name},`)}
  ${paragraph(
    `Thank you for purchasing a Package ${input.packageName} and initial call with Skill Bridge. Your appointment is confirmed.`,
  )}

  ${section(
    "Your booking",
    `
    ${labeledValue("When", slot)}
    ${labeledValue("Package", input.packageName)}

    `,
  )}

  ${paragraph(
    "Before the call, please complete a short assessment if you haven't already. It helps us understand your background so we can make the conversation more useful.",
  )}
  ${btnLink(assessmentUrl, "Complete your assessment", "primary")}

  ${input.htmlLink ? btnLink(input.htmlLink, "View calendar event", "link") : ""}

  ${textContent.contact()}
  `;
}

export async function consultationNotificationToAdmin(
  input: ConsultationEmailInput,
): Promise<string> {
  const name = input.name.trim() || "Unknown";
  const email = input.email.trim() || "unknown";
  const slot = formatSlotRange(input.startTime, input.endTime, input.timeZone);
  const assessmentBtn = await getAssessmentBtnFromEmail(email);

  return `
  ${heading(`New Package ${input.packageName} is purchased and initial call booked`) }
  ${paragraph("Hi Admin,")}
  ${paragraph(`Someone booked a Package ${input.packageName} and initial call with Skill Bridge. Details below:`) }

  ${section(
    "Consultation details",
    `
    ${labeledValue("Name", name)}
    ${labeledValue("Email", email)}
    ${labeledValue("Phone", input.phone)}
    ${labeledValue("Lives in UK", formatLivesInUk(input.livesInUk))}
    ${labeledValue("Current visa", formatCurrentVisa(input.livesInUk, input.currentVisa))}
    ${labeledValue("When", slot)}
    ${labeledValue("Package", input.packageName)}
    ${labeledValue("Amount paid", formatAmount(input.price))}
    `,
  )}

  ${section("Description", descriptionBlock(input.description))}

  ${btnLink(`mailto:${email}`, "Email customer", "primary")}
  ${input.htmlLink ? btnLink(input.htmlLink, "Open calendar event", "link") : ""}
  ${assessmentBtn}

  ${paragraph("This is an automated notification from Skill Bridge.")}
  `;
}

export function freeConsultationThankYouToUser(
  input: ConsultationEmailInput,
): string {
  const name = input.name.trim() || "there";
  const assessmentUrl = `${env.frontendUrl}/assessment`;
  const slot = formatSlotRange(input.startTime, input.endTime, input.timeZone);

  return `
  ${heading("Your free Strategy Call consultation is booked")}
  ${paragraph(`Hi ${name},`)}
  ${paragraph(
    "Thank you for booking a complimentary consultation with Skill Bridge. Your appointment is confirmed — there is nothing to pay.",
  )}

  ${section(
    "Your booking",
    `
    ${labeledValue("When", slot)}
    ${labeledValue("Type", "Free Strategy Call")}
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

export function freeConsultationNotificationToAdmin(
  input: ConsultationEmailInput,
): string {
  const name = input.name.trim() || "Unknown";
  const email = input.email.trim() || "unknown";
  const slot = formatSlotRange(input.startTime, input.endTime, input.timeZone);

  return `
  ${heading("New free Strategy Call booked")}
  ${paragraph("Hi Admin,")}
  ${paragraph(
    "Someone booked a complimentary Skill Bridge Strategy Call. Details below:",
  )}

  ${section(
    "Consultation details",
    `
    ${labeledValue("Name", name)}
    ${labeledValue("Email", email)}
    ${labeledValue("When", slot)}
    ${labeledValue("Starts", formatUkDateTime(input.startTime, input.timeZone))}
    ${labeledValue("Ends", formatUkDateTime(input.endTime, input.timeZone))}
    ${labeledValue("Type", "Free Strategy Call")}
    `,
  )}

  ${section("Description", descriptionBlock(input.description))}

  ${btnLink(`mailto:${email}`, "Email customer", "primary")}
  ${input.htmlLink ? btnLink(input.htmlLink, "Open calendar event", "link") : ""}

  ${paragraph("This is an automated notification from Skill Bridge.")}
  `;
}
