export type PriorityLevel = "high" | "medium" | "easy";

export type RouteId = "digital-technology" | "academia" | "arts";

export type FileMeta = { name: string; size: number; type: string };

/**
 * Empty / unanswered → []
 * checkbox → string[]
 * radio | chips (single) | text → string
 * file → FileMeta | []
 */
export type AnswerValue = string | string[] 

/** Keys are always `{sectionId}_{questionId}` */
export type AssessSectionAnswers = Record<string, AnswerValue>;

/**
 * Top-level keys:
 * - routeId: string
 * - resumeLink?: string (optional Cloudinary URL; also accepted beside payload)
 * - one object per section (9 sections)
 */
export type AssessPayload = {
  routeId: RouteId;
  resumeLink?: string;
  [sectionId: string]: string | AssessSectionAnswers | undefined;
};

export type ScoreBreakdownItem = {
  id: string;
  label: string;
  score: number;
};

export type PriorityImprovement = {
  id: string;
  priority: PriorityLevel;
  title: string;
  description: string;
};

/** Flat report JSON returned by GET /assessments/:id and stored in assessments.report */
export type Assessment = {
  id: string;
  routeId: string;
  customerName?: string;
  customerEmail?: string;
  summary: string;
  headline: string;
  confidenceScore: number;
  breakdown: ScoreBreakdownItem[];
  strengths: string[];
  improvements: string[];
  priorityImprovements: PriorityImprovement[];
  overallRecommendation: string;
};

export type EmailAssessmentBody = {
  email?: string;
};

export type EmailAssessmentResponse = {
  message?: string;
};

export const ROUTE_SECTIONS: Record<RouteId, string[]> = {
  "digital-technology": [
    "leadership",
    "innovation",
    "impact",
    "recognition",
    "publicProfile",
    "evidence",
    "recommendationLetters",
    "futurePlans",
    "personalDetails",
  ],
  academia: [
    "leadership",
    "research",
    "impact",
    "recognition",
    "publicProfile",
    "evidence",
    "recommendationLetters",
    "futurePlans",
    "personalDetails",
  ],
  arts: [
    "leadership",
    "creativeWork",
    "impact",
    "recognition",
    "publicProfile",
    "evidence",
    "recommendationLetters",
    "futurePlans",
    "personalDetails",
  ],
};

export const BREAKDOWN_IDS = [
  "leadership",
  "innovation",
  "impact",
  "recognition",
  "publicProfile",
  "recommendationLetters",
  "futurePlans",
] as const;
