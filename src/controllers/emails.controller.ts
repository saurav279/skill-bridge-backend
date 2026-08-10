import type { Assessment } from "../types/assessment";

export function assessmentEmailTemplate(
  assessment: Assessment,
): string {
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
