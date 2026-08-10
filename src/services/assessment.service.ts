import { AssessmentModel } from "../models/assessment.model";
import type {
  AssessPayload,
  EligibilityAssessment,
  EmailAssessmentResponse,
} from "../types/assessment";
import { ROUTE_SECTIONS, type RouteId } from "../types/assessment";
import { NotFoundError, ValidationError } from "../utils/errors";
import { createAssessmentId } from "../utils/id";
import { assessmentEmailTemplate } from "../controllers/emails.controller";
import { sendEmail } from "./email.service";
import { buildAssessmentReport } from "./scoring.service";
import { S3Service } from "./s3.service";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validatePayload(payload: AssessPayload): void {
  const routeId = payload.routeId;
  if (
    routeId !== "digital-technology" &&
    routeId !== "academia" &&
    routeId !== "arts"
  ) {
    throw new ValidationError(
      'routeId must be "digital-technology", "academia", or "arts"',
    );
  }

  const expected = ROUTE_SECTIONS[routeId as RouteId];
  for (const sectionId of expected) {
    if (!isPlainObject(payload[sectionId])) {
      throw new ValidationError(`Missing or invalid section: ${sectionId}`);
    }
  }
}

function extractResumeFileId(payload: AssessPayload): string | null {
  const topLevel = payload.resumeFileId;
  if (typeof topLevel === "string" && topLevel.trim()) {
    return topLevel.trim();
  }
  return null;
}

export const AssessmentService = {
  async create(
    payload: AssessPayload,
    resumeFileId?: string | null,
  ): Promise<EligibilityAssessment> {
    validatePayload(payload);

    const storedResumeFileId =
      resumeFileId?.trim() || extractResumeFileId(payload);

    let resume;
    if (storedResumeFileId) {
      resume = await S3Service.getResumeContent(storedResumeFileId);
    }

    const id = createAssessmentId();
    const createdAt = new Date().toISOString();
    const report = await buildAssessmentReport({
      id,
      payload,
      createdAt,
      resume,
    });

    await AssessmentModel.create({
      id,
      routeId: payload.routeId,
      contactName: report.customerName,
      contactEmail: report.customerEmail,
      resumeFileId: storedResumeFileId,
      payload,
      report,
      confidenceScore: report.confidenceScore,
    });

    return report;
  },

  async getById(id: string): Promise<EligibilityAssessment> {
    const row = await AssessmentModel.findById(id);
    if (!row) {
      throw new NotFoundError(`Assessment not found: ${id}`);
    }
    return row.report;
  },

  async emailReport(
    id: string,
    email?: string,
  ): Promise<EmailAssessmentResponse> {
    const row = await AssessmentModel.findById(id);
    if (!row) {
      throw new NotFoundError(`Assessment not found: ${id}`);
    }

    const to =
      email?.trim() || row.contact_email || row.report.customerEmail;
    if (!to) {
      throw new ValidationError(
        "No email provided and assessment has no customerEmail",
      );
    }

    await sendEmail({ subject: `Your Skill Bridge assessment (${row.report.confidenceScore}/100)`, body: assessmentEmailTemplate(row.report), to });

    return { message: "Assessment email sent." };
  },
};
