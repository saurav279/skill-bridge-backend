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
import { formatCurrentVisa, formatLivesInUk } from "../utils/intake";
import { env } from "../config/env";

export type ContactUsEmailInput = {
  name: string;
  email: string;
  phone: string;
  livesInUk: boolean;
  currentVisa?: string | null;
  prefered: "phone" | "email";
  subject: string;
  message: string;
};

function messageBlock(message: string): string {
  const safe = escapeHtml(message.trim() || "-").replaceAll("\n", "<br>");
  return `<p>${safe}</p>`;
}

function formatPrefered(prefered: "phone" | "email"): string {
  return prefered === "phone" ? "Phone" : "Email";
}

export function contactUsThankYouToUser(input: ContactUsEmailInput): string {
  const name = input.name.trim() || "there";
  const subject = input.subject.trim() || "your enquiry";
  const strategyCallUrl = `${env.frontendUrl}/packages/strategy-call`;


  return `
  ${heading(`Re: ${subject}`)}
  ${paragraph(`Hi ${name},`)}
  ${paragraph(
    "Thank you for reaching out to Skill Bridge. We have received your message and will get back to you within five business day.",
  )}

  ${section(
    "Your enquiry",
    `
    ${labeledValue("Subject", subject)}
    ${section("Message", messageBlock(input.message))}
    `,
  )}

  ${paragraph(
    " Need personalised guidance sooner? Book a 1:1 strategy call and get your personalized slot to discuss your assessment, explore your UK options, and get clear on your next steps with our team.",
  )}
  ${btnLink(strategyCallUrl, "Book a strategy call", "primary")}

  ${textContent.contact()}
  `;
}

export async function contactUsNotificationToAdmin(
  input: ContactUsEmailInput,
): Promise<string> {
  const name = input.name.trim() || "Unknown";
  const email = input.email.trim() || "unknown";
  const subject = input.subject.trim() || "-";
  const assessmentBtn = await getAssessmentBtnFromEmail(email);

  return `
  ${heading("New contact enquiry")}
  ${paragraph("Hi Admin,")}
  ${paragraph(
    "Someone submitted the Skill Bridge contact form. Details below:",
  )}

  ${section(
    "Contact details",
    `
    ${labeledValue("Name", name)}
    ${labeledValue("Email", email)}
    ${labeledValue("Phone", input.phone)}
    ${labeledValue("Lives in UK", formatLivesInUk(input.livesInUk))}
    ${labeledValue("Current visa", formatCurrentVisa(input.livesInUk, input.currentVisa))}
    ${labeledValue("Preferred contact", formatPrefered(input.prefered))}
    ${labeledValue("Subject", subject)}
    `,
  )}

  ${section("Message", messageBlock(input.message))}
  ${assessmentBtn}
  ${btnLink(`mailto:${email}?subject=${encodeURIComponent(`Re: ${subject}`)}`, "Reply to sender", "primary")}

  ${paragraph("This is an automated notification from Skill Bridge.")}
  `;
}
