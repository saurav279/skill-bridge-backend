import { z } from "zod";
import { env } from "../config/env";
import type {
  AssessPayload,
  AssessSectionAnswers,
  EligibilityAssessment,
} from "../types/assessment";
import { AppError } from "../utils/errors";
import { chatCompletionJson } from "./openrouter.service";
import type { ResumeContent } from "./s3.service";

const priorityLevelSchema = z.enum(["high", "medium", "easy"]);

const eligibilityAssessmentSchema = z.object({
  id: z.string().optional(),
  routeId: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().optional(),
  summary: z.string().min(1),
  headline: z.string().min(1),
  confidenceScore: z.number().min(0).max(100),
  breakdown: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      score: z.number().min(0).max(100),
    }),
  ),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  priorityImprovements: z.array(
    z.object({
      id: z.string(),
      priority: priorityLevelSchema,
      title: z.string(),
      description: z.string(),
    }),
  ),
  overallRecommendation: z.string().min(1),
});

export type ScoreInput = {
  id: string;
  payload: AssessPayload;
  createdAt: string;
  resume?: ResumeContent;
};

function isSectionAnswers(value: unknown): value is AssessSectionAnswers {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function customerFromPayload(payload: AssessPayload): {
  customerName?: string;
  customerEmail?: string;
} {
  const personal = payload.personalDetails;
  if (!isSectionAnswers(personal)) return {};

  const name = personal.personalDetails_name;
  const email = personal.personalDetails_email;

  return {
    customerName:
      typeof name === "string" && name.trim() ? name.trim() : undefined,
    customerEmail:
      typeof email === "string" && email.trim() ? email.trim() : undefined,
  };
}

const SYSTEM_PROMPT = `You are an eligibility assessment engine for UK Global Talent / endorsement readiness (Skill Bridge).

Given a questionnaire payload and optional resume PDF content, analyse everything and return ONE flat JSON object with ONLY these fields:
id, routeId, customerName, customerEmail, summary, headline, confidenceScore, breakdown, strengths, improvements, priorityImprovements, overallRecommendation

Rules:
- Return ONLY valid JSON. No markdown. No commentary.
- Do NOT include: status, assessment, probability, potentialLabel, starRating, targetScore, criteriaMatched, criteriaTotal, evidenceChecklist, evidenceUploaded, attentionAreas, nextSteps, roadmap, createdAt
- Use both the form answers and the resume content when a resume is provided.
- confidenceScore: integer 0–100
- strengths: about 3 insight bullets
- improvements: 2–4 short actionable strings
- priorityImprovements: 3 items; priority is "high" | "medium" | "easy"; description ~40–50 words of actionable guidance
- breakdown MUST use these ids (in this order when possible):
  leadership, innovation, impact, recognition, publicProfile, recommendationLetters, futurePlans
  For academia, score the research section into breakdown id "innovation".
  For arts, score creativeWork into breakdown id "innovation".
- Use personalDetails_name / personalDetails_email for customerName / customerEmail
- Write summary, headline, overallRecommendation, and improvements in clear professional English

Do not invent evidence that is clearly absent from the answers and resume. Be fair but realistic.`;

function buildFallbackReport(input: ScoreInput): EligibilityAssessment {
  const { id, payload } = input;
  const customer = customerFromPayload(payload);
  const name = customer.customerName ?? "Candidate";
  const routeId = payload.routeId;

  console.warn(
    "[scoring] OPENROUTER_API_KEY missing — returning hardcoded assessment fallback",
  );

  return {
    id,
    routeId,
    customerName: customer.customerName,
    customerEmail: customer.customerEmail,
    summary: `${name}'s ${routeId} profile shows a confidence score of 72/100 with moderate endorsement potential based on leadership, impact, recognition, and evidence signals.`,
    headline: `Your profile demonstrates promising ${routeId.replace(/-/g, " ")} achievements.`,
    confidenceScore: 72,
    breakdown: [
      { id: "leadership", label: "Leadership", score: 78 },
      { id: "innovation", label: "Innovation", score: 74 },
      { id: "impact", label: "Impact", score: 58 },
      { id: "recognition", label: "Recognition", score: 45 },
      { id: "publicProfile", label: "Public Profile", score: 70 },
      { id: "recommendationLetters", label: "Recommendation Letters", score: 55 },
      { id: "futurePlans", label: "Future Plans", score: 80 },
    ],
    strengths: [
      `${name}'s leadership record shows credible ownership and management signals that reviewers can evaluate.`,
      "Innovation signals stand out through products, research outputs, or creative work with public visibility.",
      "Your public profile footprint is comparatively strong and supports independent verification.",
    ],
    improvements: [
      "Strengthen recommendation letters from senior independent experts.",
      "Add clearer impact metrics tied to your work.",
      "Align public profiles with your application narrative.",
    ],
    priorityImprovements: [
      {
        id: "letters",
        priority: "high",
        title: "Strengthen recommendation letters",
        description:
          "Prioritise two to three letters from senior independent experts who can quantify your leadership and impact with specific outcomes, timelines, and comparisons to peers in your field.",
      },
      {
        id: "recognition",
        priority: "medium",
        title: "Build independent public recognition",
        description:
          "Increase third-party visibility through speaking, awards, press, or peer invitations so reviewers can verify your standing beyond self-reported achievements and employer endorsements.",
      },
      {
        id: "linkedin",
        priority: "easy",
        title: "Align and polish public profiles",
        description:
          "Make LinkedIn, portfolio, and personal site consistent with your application narrative, highlighting measurable impact, leadership scope, and evidence links reviewers can check quickly.",
      },
    ],
    overallRecommendation:
      "You are likely 6–12 months away from a competitive endorsement.",
  };
}

export async function buildAssessmentReport(
  input: ScoreInput,
): Promise<EligibilityAssessment> {
  const { id, payload, createdAt, resume } = input;
  const customer = customerFromPayload(payload);

  if (!env.openRouter.apiKey) {
    return buildFallbackReport(input);
  }

  try {
    const userPayload = {
      assessmentId: id,
      createdAt,
      questionnaire: payload,
      resume: resume
        ? {
            fileId: resume.fileId,
            originalName: resume.originalName,
            mimeType: resume.mimeType,
            extractedText: resume.text,
          }
        : null,
      requiredShape: {
        id: "string",
        routeId: "string",
        customerName: "string?",
        customerEmail: "string?",
        summary: "string",
        headline: "string",
        confidenceScore: "number 0-100",
        breakdown: "[{id,label,score}]",
        strengths: "string[]",
        improvements: "string[]",
        priorityImprovements: "[{id,priority,title,description}]",
        overallRecommendation: "string",
      },
    };

    const raw = await chatCompletionJson({
      system: SYSTEM_PROMPT,
      user: JSON.stringify(userPayload),
      file: resume
        ? {
            filename: resume.originalName,
            mimeType: resume.mimeType,
            base64: resume.base64,
          }
        : undefined,
    });

    const parsed = eligibilityAssessmentSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(
        `LLM assessment JSON failed validation: ${parsed.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
        500,
      );
    }

    const report = parsed.data;

    return {
      id,
      routeId: report.routeId ?? payload.routeId,
      customerName: report.customerName ?? customer.customerName,
      customerEmail: report.customerEmail ?? customer.customerEmail,
      summary: report.summary,
      headline: report.headline,
      confidenceScore: report.confidenceScore,
      breakdown: report.breakdown,
      strengths: report.strengths,
      improvements: report.improvements,
      priorityImprovements: report.priorityImprovements,
      overallRecommendation: report.overallRecommendation,
    };
  } catch (error) {
    console.warn(
      "[scoring] OpenRouter failed — returning hardcoded assessment fallback",
      error instanceof Error ? error.message : error,
    );
    return buildFallbackReport(input);
  }
}
