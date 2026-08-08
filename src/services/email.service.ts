import nodemailer from "nodemailer";
import { env } from "../config/env";
import type { EligibilityAssessment } from "../types/assessment";
import { AppError } from "../utils/errors";

export type SendAssessmentEmailInput = {
  to: string;
  assessment: EligibilityAssessment;
};

function createTransport() {
  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass) {
    throw new AppError(
      "SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.",
      500,
    );
  }

  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
  });
}

function buildEmailBody(assessment: EligibilityAssessment): string {
  const name = assessment.customerName ?? "there";
  const improvements = assessment.improvements
    .map((item) => `• ${item}`)
    .join("\n");
  const strengths = assessment.strengths
    .map((item) => `• ${item}`)
    .join("\n");

  return [
    `Hi ${name},`,
    "",
    "Your Skill Bridge eligibility assessment is ready.",
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

export async function sendAssessmentEmail(
  input: SendAssessmentEmailInput,
): Promise<void> {
  const transport = createTransport();

  try {
    await transport.sendMail({
      from: env.smtp.from,
      to: input.to,
      subject: `Your Skill Bridge assessment (${input.assessment.confidenceScore}/100)`,
      text: buildEmailBody(input.assessment),
    });
  } catch (error) {
    throw new AppError(
      `Failed to send assessment email: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
      500,
    );
  }
}
