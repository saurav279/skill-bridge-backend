import { escapeHtml, heading, paragraph } from "./helpers";

export function adminOtpEmailTemplate(otp: string): string {
  return `
  ${heading("Admin login code")}
  ${paragraph(
    "Use this one-time code to finish signing in to Skill Bridge admin. It expires in 10 minutes.",
  )}
  <p style="font-size:32px;letter-spacing:8px;font-weight:700;">${escapeHtml(otp)}</p>
  ${paragraph("If you did not request this code, you can ignore this email.")}
  `;
}
