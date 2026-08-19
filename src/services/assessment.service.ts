import { AssessmentModel } from "../models/assessment.model";
import type {
  AssessPayload,
  Assessment,
  EmailAssessmentResponse,
} from "../types/assessment";
import { ROUTE_SECTIONS, type RouteId } from "../types/assessment";
import { NotFoundError, ValidationError } from "../utils/errors";
import { createAssessmentId, createLeadId, createNoteId, createPipelineId } from "../utils/id";
import { assessmentEmailTemplate } from "../email-templates/assessment";
import { sendEmail } from "./email.service";
import { buildAssessmentReport } from "./scoring.service";
import { S3Service } from "./s3.service";
import { LeadModel } from "../models/lead.model";
import { NoteModel } from "../models/note.model";
import { PipelineModel } from "../models/pipeline.model";

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

function extractPhone(payload: AssessPayload): string | null {
  const personal = payload.personalDetails;
  if (!isPlainObject(personal)) {
    return null;
  }

  if (typeof personal.phone === "string" && personal.phone.trim()) {
    return personal.phone.trim();
  }
  if (
    typeof personal.personalDetails_phone === "string" &&
    personal.personalDetails_phone.trim()
  ) {
    return personal.personalDetails_phone.trim();
  }
  return null;
}

function extractLivesInUk(personal: unknown): boolean | undefined {
  if (!isPlainObject(personal)) {
    return undefined;
  }
  if (typeof personal.livesInUk === "boolean") {
    return personal.livesInUk;
  }
  if (personal.personalDetails_livesInUk === "Yes") {
    return true;
  }
  if (personal.personalDetails_livesInUk === "No") {
    return false;
  }
  return undefined;
}

function extractCurrentVisa(personal: unknown): string | undefined {
  if (!isPlainObject(personal)) {
    return undefined;
  }
  if (typeof personal.currentVisa === "string" && personal.currentVisa.trim()) {
    return personal.currentVisa.trim();
  }
  const visa = personal.personalDetails_ukVisa;
  if (visa === "Others") {
    const other = personal.personalDetails_ukVisaOther;
    return typeof other === "string" && other.trim() ? other.trim() : undefined;
  }
  if (typeof visa === "string" && visa.trim()) {
    return visa.trim();
  }
  return undefined;
}
function extractCustomerPhone(personal: unknown): string | undefined {
  if (!isPlainObject(personal)) {
    return undefined;
  }
  if (typeof personal.phone === "string" && personal.phone.trim()) {
    return personal.phone.trim();
  }
  if (typeof personal.personalDetails_phone === "string" && personal.personalDetails_phone.trim()) {
    return personal.personalDetails_phone.trim();
  }
  return undefined;
}
function extractResumeLink(payload: AssessPayload): string | null {
  const topLevel = payload.resumeLink;
  if (typeof topLevel === "string" && topLevel.trim()) {
    return topLevel.trim();
  }
  return null;
}

export const AssessmentService = {
  async create(
    payload: AssessPayload,
    resumeLink?: string | null,
  ): Promise<Assessment> {
    validatePayload(payload);

    const storedResumeLink = resumeLink?.trim() || extractResumeLink(payload);

    let resume;
    if (storedResumeLink) {
      resume =
        await S3Service.getResumeContentFromCloudinary(storedResumeLink);
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
      phone: extractPhone(payload),
      resumeLink: storedResumeLink,
      payload,
      report,
      confidenceScore: report.confidenceScore,
    });

 
    const lead = await LeadModel.create({
      id: createLeadId(),
      email: report.customerEmail ?? "",
      name: report.customerName ?? "",
      phone: extractPhone(payload) ?? "",
      priority: "High",
    });
    if (lead.id) {
      await NoteModel.create({
        id: createNoteId(),
        leadId: lead.id,
        note: `Assessment Completed: The assessment was completed with a confidence score of ${report.confidenceScore}/100.`,
        notedBy: "System",
      });
      await PipelineModel.create({
        id: createPipelineId(),
        leadId: lead.id,
        status: "Assessment Completed",
      });
    }

    return report;
  },

  async getById(id: string): Promise<
    Assessment & {
      createdAt: string;
      customerLivesInUk?: boolean;
      customerPhone?: string;
      customerCurrentVisa?: string;
    }
  > {
    const row = await AssessmentModel.findById(id);

    if (!row) {
      throw new NotFoundError(`Assessment not found: ${id}`);
    }

    const personal = row.payload?.personalDetails;
    return {
      ...row.report,
      createdAt: row.created_at as string,
      customerLivesInUk: extractLivesInUk(personal),
      customerCurrentVisa: extractCurrentVisa(personal),
      customerPhone: extractCustomerPhone(personal),
    };
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
