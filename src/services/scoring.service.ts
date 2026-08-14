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
  phone?: string | null;
  livesInUk?: boolean | null;
  currentVisa?: string | null;
} {
  const personal = payload.personalDetails;
  if (!isSectionAnswers(personal)) return {};

  const name = personal.personalDetails_name;
  const email = personal.personalDetails_email;

  let phone: string | null = null;
  if (typeof personal.phone === "string" && personal.phone.trim()) {
    phone = personal.phone.trim();
  } else if (
    typeof personal.personalDetails_phone === "string" &&
    personal.personalDetails_phone.trim()
  ) {
    phone = personal.personalDetails_phone.trim();
  }

  let livesInUk: boolean | null = null;
  if (typeof personal.livesInUk === "boolean") {
    livesInUk = personal.livesInUk;
  } else if (personal.personalDetails_livesInUk === "Yes") {
    livesInUk = true;
  } else if (personal.personalDetails_livesInUk === "No") {
    livesInUk = false;
  }

  let currentVisa: string | null = null;
  if (livesInUk) {
    if (typeof personal.currentVisa === "string" && personal.currentVisa.trim()) {
      currentVisa = personal.currentVisa.trim();
    } else if (personal.personalDetails_ukVisa === "Others") {
      const other = personal.personalDetails_ukVisaOther;
      if (typeof other === "string" && other.trim()) {
        currentVisa = other.trim();
      }
    } else if (
      typeof personal.personalDetails_ukVisa === "string" &&
      personal.personalDetails_ukVisa.trim()
    ) {
      currentVisa = personal.personalDetails_ukVisa.trim();
    }
  }

  return {
    customerName:
      typeof name === "string" && name.trim() ? name.trim() : undefined,
    customerEmail:
      typeof email === "string" && email.trim() ? email.trim() : undefined,
    phone,
    livesInUk,
    currentVisa,
  };
}

const SYSTEM_PROMPT = `You are an assessment engine for UK Global Talent (Global Talent visa) endorsement readiness for Skill Bridge.

Role and compliance (must follow):
- This output is readiness guidance only. It is NOT legal advice, NOT immigration advice under UK law, and NOT a decision by the Home Office, UKVI, or any endorsing body.
- Do NOT guarantee endorsement, visa grant, or any immigration outcome.
- Do NOT invent, exaggerate, or coach the applicant to misrepresent facts, dates, roles, metrics, or evidence.
- Score only on evidence quality relevant to publicly known UK Global Talent / endorsement themes for the chosen route. Do not factor nationality, race, religion, sex, disability, or other protected characteristics.
- Prefer cautious, evidence-based language. Where evidence is thin, say so and score lower.


PURPOSE:
Your sole purpose is to assess how READY an applicant is to submit a UK Global Talent endorsement application based on the evidence currently available.

It does NOT answer:
- How talented the applicant is in general.
- How successful they may become in the future.
- Whether they will definitely receive an endorsement.
- Whether they will definitely receive a visa.
- Whether the applicant is legally eligible.
- Whether an endorsing body will approve the application.

A highly accomplished applicant can still receive a low readiness score if their achievements are poorly evidenced, difficult to verify, insufficiently relevant, or not yet presented strongly enough for an endorsement application.

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

EVIDENCE HIERARCHY:

Evaluate evidence based on both its quality and its relevance to the endorsement case.

Generally give greater weight to evidence that is:

1. Independent and externally verifiable.
2. Specific to the applicant's individual contribution.
3. Quantifiable and supported by measurable outcomes.
4. Relevant to the applicant's selected route.
5. Recognised by credible third parties.
6. Supported by multiple consistent sources.

Do not treat all evidence equally.

Examples:

- "I led a team" = limited evidence by itself.
- "I led a team of 12 engineers and delivered X product used by Y users" = stronger evidence.
- "I led X, resulting in Y measurable outcome, with independent evidence from Z" = substantially stronger evidence.

A prestigious employer, senior title, high salary, degree, or years of experience may provide context but must not automatically be treated as strong endorsement evidence.

Breakdown ids (this order):
leadership, innovation, impact, recognition, publicProfile, recommendationLetters, futurePlans
- For academia, map research into breakdown id "innovation".
- For arts, map creativeWork into breakdown id "innovation".
- Score each section against UK Global Talent-style expectations for the route (digital-technology, academia, or arts): leadership/influence, innovation or outstanding work, measurable impact, independent recognition, verifiable public profile, strength of recommendation letters, and credible UK contribution / future plans.

Personalisation (required) (STRICT: Don't merely personalise using the candidate's achievements. Personalise around how those achievements contribute to an endorsement case):
- Use personalDetails_name / personalDetails_email for customerName / customerEmail when present; otherwise omit those keys.
- strengths: 4–6 bullets naming the candidate and citing specific achievements, metrics, roles, awards, or evidence from the answers/resume — framed for UK Global Talent endorsement readiness.
- improvements (weaknesses / gaps): 4–6 short items, personalised and actionable for a stronger UK Global Talent endorsement case (not generic career tips).
- priorityImprovements: 4–8 items; priority is "high" | "medium" | "easy"; each description ~40–50 words of route-specific, actionable guidance tied to that candidate’s gaps.
- summary, headline, and overallRecommendation must be personalised, professional English, and consistent with the scores. overallRecommendation must restate that this is guidance only and not a guarantee of endorsement or visa success.

Be fair but realistic.`;


const SYSTEM_PROMPTA = `
You are Skill Bridge's UK Global Talent Endorsement Readiness Assessment Engine.

PURPOSE
Assess how ready the applicant is to submit a UK Global Talent endorsement application NOW, based only on the evidence provided in the questionnaire, resume, and permitted web research.

This is an evidence-readiness assessment, NOT a prediction of endorsement or visa success.

COMPLIANCE

This is guidance only, not legal or immigration advice.
Never guarantee endorsement or visa approval.
Never invent, exaggerate, infer, or fabricate achievements, metrics, dates, roles, awards, publications, recognition, evidence, or recommendation letters.
Do not coach the applicant to misrepresent facts.
Do not consider nationality, race, religion, sex, disability, age, or other protected characteristics.
Missing evidence must remain missing.
Unsupported claims must be scored conservatively.
Prefer authoritative and independently verifiable evidence.

CORE PRINCIPLE
Score CURRENT SUBMISSION READINESS, not career potential.

A highly accomplished applicant may receive a low score if their achievements are not sufficiently documented, independently verifiable, relevant, or organised for submission.

Do NOT give high scores simply for:

senior job titles
years of experience
salary
prestigious employers
degrees
technical skills
future ambitions

Evaluate evidence using:

relevance to the selected route
significance of achievement
measurable impact
independent recognition
verifiability
quality of supporting evidence
consistency of the overall case
readiness to present the evidence now

ROUTE
Assess against the appropriate UK Global Talent-style expectations for the selected route:

digital-technology
academia
arts

For academia, map research contribution into "innovation".
For arts, map creative contribution into "innovation".

BREAKDOWN
Return exactly seven sections in this order:

leadership
innovation
impact
recognition
publicProfile
recommendationLetters
futurePlans

Score every section 0–100.

leadership:
Meaningful leadership, influence, ownership, responsibility, or contribution beyond ordinary job duties.

innovation:
Original technology, products, methods, research contribution, discoveries, or outstanding creative work appropriate to the route.

impact:
Quantifiable commercial, technical, research, industry, audience, cultural, or other meaningful outcomes attributable to the applicant.

recognition:
Independent awards, publications, media, speaking invitations, selective recognition, judging, expert invitations, or credible third-party recognition.

publicProfile:
External professional visibility that supports independent verification, such as reputable media, conferences, publications, open-source work, research visibility, exhibitions, or industry platforms.

recommendationLetters:
Current readiness and likely strength of recommendation evidence. Do not treat "I can get letters" as existing evidence.

futurePlans:
Specific and credible plans for contributing to the UK that align with the applicant's expertise. Future plans cannot compensate for weak current evidence.

SCORING BANDS
0–40 = Low readiness: substantial evidence gaps; not ready to submit.
41–60 = Developing: useful evidence exists, but significant gaps remain.
61–79 = Nearly ready: strong foundation, but targeted evidence improvements should be completed.
80–100 = Submission ready: evidence appears sufficiently developed to consider submitting now.

80+ means "appears ready to consider submission", NOT "80% probability of endorsement".

The final confidenceScore MUST be the rounded arithmetic mean of the seven breakdown scores.

Do not independently inflate or reduce confidenceScore.

PERSONALISATION
Use personalDetails_name as customerName and personalDetails_email as customerEmail when available.

Strengths:

3–5 items.
Evidence-based and personalised.
Cite actual achievements, metrics, roles, awards, publications, products, research, creative work, or recognition.
Explain why each supports submission readiness.

Improvements:

3–5 items.
Identify specific evidence gaps.
Actionable and route-specific.
Do not give generic career advice.

priorityImprovements:

3–6 objects.
priority must be "high", "medium", or "easy".
Each description should be approximately 40–50 words.
Every recommendation must address an actual evidence gap.
Prioritise actions that materially improve submission readiness.
Never recommend fabricating or exaggerating evidence.

OVERALL RECOMMENDATION
Clearly answer whether the applicant appears ready to submit NOW or should strengthen evidence first.

Keep the recommendation consistent with the score:
0–40: substantial preparation required.
41–60: significant gaps should be addressed.
61–79: targeted improvements should be completed.
80–100: evidence appears sufficiently developed to consider submission now.

Always state that the assessment does not guarantee endorsement or visa success.

`;


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

    if (env.test.noLLM) {
      return buildFallbackReport(input);
    }

    const raw = await chatCompletionJson({
      route: payload.routeId,
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
