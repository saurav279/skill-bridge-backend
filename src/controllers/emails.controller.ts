import type { Assessment } from "../types/assessment";

export function assessmentEmailTemplate(assessment: Assessment): string {
  const name = assessment.customerName ?? "there";
  const improvements = assessment.improvements
    .map((item) => `• ${item}`)
    .join("\n");
  const strengths = assessment.strengths.map((item) => `• ${item}`).join("\n");

  return [
    `Hi ${name},`,
    "",
    "Your Skill Bridge assessment is ready.",
    "",
    `Confidence score: ${assessment.confidenceScore}/100`,
    "",
    assessment.headline,
    "",
    assessment.summary,
    "",
    "Strengths:",
    strengths || "• Review your profile highlights.",
    "",
    "Improvements:",
    improvements || "• Review your profile and evidence.",
    "",
    assessment.overallRecommendation,
    "",
    `Assessment ID: ${assessment.id}`,
    "",
    "— Skill Bridge",
  ].join("\n");
}

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


export const packagePurchasedEmailTemplateToAdmin = (input: { customerName: string, customerEmail: string, packageName: string, packagePrice: number }): string => {
  const customerName = input.customerName.trim() || "there";
  const packageName = input.packageName.trim() || "package";
  const packagePrice = input.packagePrice.toFixed(2);
  const customerEmail = input.customerEmail.trim() || "unknown";

  return [
    `Hi Admin,`,
    "",
    `${customerName} (${customerEmail}) has purchased ${packageName} for £${packagePrice}.`,
    "",
    "— Skill Bridge",
  ].join("\n");
}