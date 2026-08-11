import { z } from "zod";
import { env } from "../config/env";
import type {
  AssessPayload,
  AssessSectionAnswers,
  Assessment,
} from "../types/assessment";
import { AppError } from "../utils/errors";
import { chatCompletionJson } from "./openrouter.service";
import type { ResumeContent } from "./s3.service";

const priorityLevelSchema = z.enum(["high", "medium", "easy"]);

const  assessmentSchema = z.object({
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

const SYSTEM_PROMPT = `You are an assessment engine for UK Global Talent (Global Talent visa) endorsement readiness for Skill Bridge.

Role and compliance (must follow):
- This output is readiness guidance only. It is NOT legal advice, NOT immigration advice under UK law, and NOT a decision by the Home Office, UKVI, or any endorsing body.
- Do NOT guarantee endorsement, visa grant, or any immigration outcome.
- Do NOT invent, exaggerate, or coach the applicant to misrepresent facts, dates, roles, metrics, or evidence.
- Score only on evidence quality relevant to publicly known UK Global Talent / endorsement themes for the chosen route. Do not factor nationality, race, religion, sex, disability, or other protected characteristics.
- Prefer cautious, evidence-based language. Where evidence is thin, say so and score lower.

Given a questionnaire payload and optional resume content, analyse everything and return ONE flat JSON object with ONLY these fields:
id, routeId, customerName, customerEmail, summary, headline, confidenceScore, breakdown, strengths, improvements, priorityImprovements, overallRecommendation

JSON rules:
- Return ONLY valid JSON. No markdown. No commentary.
- Never use null. Omit optional keys (id, routeId, customerName, customerEmail) if unknown; otherwise use non-empty strings.
- Do NOT include: status, assessment, probability, potentialLabel, starRating, targetScore, criteriaMatched, criteriaTotal, evidenceChecklist, evidenceUploaded, attentionAreas, nextSteps, roadmap, createdAt

Scoring rules (critical — same 0–100 scale everywhere):
- Every breakdown[].score MUST be an integer 0–100. Never use a 0–10 scale.
- confidenceScore MUST be an integer 0–100 and MUST equal the rounded arithmetic mean of the seven breakdown scores (allow at most ±5). If breakdown scores are low, confidenceScore MUST be low. Do not return a high readiness score with weak section scores.
- Use both form answers and resume content when a resume is provided. Do not invent evidence that is absent.

Breakdown ids (this order):
leadership, innovation, impact, recognition, publicProfile, recommendationLetters, futurePlans
- For academia, map research into breakdown id "innovation".
- For arts, map creativeWork into breakdown id "innovation".
- Score each section against UK Global Talent-style expectations for the route (digital-technology, academia, or arts): leadership/influence, innovation or outstanding work, measurable impact, independent recognition, verifiable public profile, strength of recommendation letters, and credible UK contribution / future plans.

Personalisation (required):
- Use personalDetails_name / personalDetails_email for customerName / customerEmail when present; otherwise omit those keys.
- strengths: 3–5 bullets (max 5) naming the candidate and citing specific achievements, metrics, roles, awards, or evidence from the answers/resume — framed for UK Global Talent endorsement readiness.
- improvements (weaknesses / gaps): 3–5 short items (max 5), personalised and actionable for a stronger UK Global Talent endorsement case (not generic career tips).
- priorityImprovements: 3–6 items (max 6); priority is "high" | "medium" | "easy"; each description ~40–50 words of route-specific, actionable guidance tied to that candidate’s gaps.
- summary, headline, and overallRecommendation must be personalised, professional English, and consistent with the scores. overallRecommendation must restate that this is guidance only and not a guarantee of endorsement or visa success.

Be fair but realistic.`;

function buildFallbackReport(input: ScoreInput): Assessment {
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
): Promise<Assessment> {
  const { id, payload, createdAt, resume } = input;
  const customer = customerFromPayload(payload);

  if (!env.openRouter.apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  try {
    const userPayload = {
      assessmentId: id,
      createdAt,
      questionnaire: payload,
      // resume: resume
      //   ? {
      //       fileId: resume.fileId,
      //       originalName: resume.originalName,
      //       mimeType: resume.mimeType,
      //       extractedText: resume.text,
      //     }
      //   : null,
      resume_content: resume?.text,
      requiredShape: {
        id: "string (omit if unknown; never null)",
        routeId: "string (omit if unknown; never null)",
        customerName: "string (omit if unknown; never null)",
        customerEmail: "string (omit if unknown; never null)",
        summary: "personalised non-empty string (never null)",
        headline: "personalised non-empty string (never null)",
        confidenceScore:
          "integer 0-100; must be ~mean of breakdown scores (±5); low breakdown => low confidence",
        breakdown:
          "[{id,label,score}]; each score integer 0-100 (never 0-10 scale)",
        strengths:
          "string[3-5]; max 5; personalised UK Global Talent evidence bullets",
        improvements:
          "string[3-5]; max 5; personalised UK Global Talent gaps/weaknesses",
        priorityImprovements:
          "[{id,priority,title,description}]; 3-6 items max 6; priority high|medium|easy; personalised",
        overallRecommendation:
          "personalised guidance string; not a visa/endorsement guarantee (never null)",
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

    const parsed = assessmentSchema.safeParse(raw);
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
      "[scoring] OpenRouter failed",
      error instanceof Error ? error.message : error,
    );
    throw new Error("OpenRouter failed");
  }
}
