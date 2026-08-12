import {
  btnLink,
  escapeHtml,
  heading,
  labeledValue,
  paragraph,
  section,
  textContent,
} from "./helpers";

export type ContactUsEmailInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

function messageBlock(message: string): string {
  const safe = escapeHtml(message.trim() || "-").replaceAll("\n", "<br>");
  return `<p>${safe}</p>`;
}

export function contactUsThankYouToUser(input: ContactUsEmailInput): string {
  const name = input.name.trim() || "there";
  const subject = input.subject.trim() || "your enquiry";

  return `
  ${heading("Thanks for contacting us")}
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
    "In the meantime, if you need to add anything, simply reply to this email or use the contact details below.",
  )}

  ${textContent.contact()}
  `;
}

export function contactUsNotificationToAdmin(
  input: ContactUsEmailInput,
): string {
  const name = input.name.trim() || "Unknown";
  const email = input.email.trim() || "unknown";
  const subject = input.subject.trim() || "-";

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
    ${labeledValue("Subject", subject)}
    `,
  )}

  ${section("Message", messageBlock(input.message))}

  ${btnLink(`mailto:${email}?subject=${encodeURIComponent(`Re: ${subject}`)}`, "Reply to sender", "primary")}

  ${paragraph("This is an automated notification from Skill Bridge.")}
  `;
}
