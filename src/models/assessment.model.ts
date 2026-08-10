import { db } from "../db/knex";
import type {
  AssessPayload,
  Assessment,
} from "../types/assessment";

export type AssessmentRow = {
  id: string;
  route_id: string;
  contact_name: string | null;
  contact_email: string | null;
  resume_file_id: string | null;
  payload: AssessPayload;
  report: Assessment;
  confidence_score: number;
  created_at: Date | string;
  updated_at: Date | string;
};

export type CreateAssessmentInput = {
  id: string;
  routeId: string;
  contactName?: string;
  contactEmail?: string;
  resumeFileId?: string | null;
  payload: AssessPayload;
  report: Assessment;
  confidenceScore: number;
};

const TABLE = "assessments";

export const AssessmentModel = {
  async create(input: CreateAssessmentInput): Promise<AssessmentRow> {
    const [row] = await db<AssessmentRow>(TABLE)
      .insert({
        id: input.id,
        route_id: input.routeId,
        contact_name: input.contactName ?? null,
        contact_email: input.contactEmail ?? null,
        resume_file_id: input.resumeFileId ?? null,
        payload: input.payload,
        report: input.report,
        confidence_score: input.confidenceScore,
      })
      .returning("*");

    return row;
  },

  async findById(id: string): Promise<AssessmentRow | undefined> {
    return db<AssessmentRow>(TABLE).where({ id }).first();
  },

  async updateReport(
    id: string,
    report: Assessment,
  ): Promise<AssessmentRow | undefined> {
    const [row] = await db<AssessmentRow>(TABLE)
      .where({ id })
      .update({
        report,
        updated_at: db.fn.now(),
      })
      .returning("*");

    return row;
  },
};
