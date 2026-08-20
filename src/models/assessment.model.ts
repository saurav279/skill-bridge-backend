import { db } from "../db/knex";
import type { AdminListQuery } from "../types/admin";
import type {
  AssessPayload,
  Assessment,
} from "../types/assessment";

export type AssessmentRow = {
  id: string;
  route_id: string;
  contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  resume_link: string | null;
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
  phone?: string | null;
  resumeLink?: string | null;
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
        phone: input.phone ?? null,
        resume_link: input.resumeLink ?? null,
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
  async findByEmail(email: string): Promise<{ id: string | undefined; resumeLink: string | undefined }> {
    const result = await db<AssessmentRow>(TABLE).where({ contact_email: email }).first().select("id","resume_link").orderBy("created_at", "desc");
    return {
      id: result?.id ?? undefined,
      resumeLink: result?.resume_link ?? undefined,
    };
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

  async listForAdmin(
    query: AdminListQuery,
  ): Promise<{ rows: AssessmentRow[]; total: number }> {
    const q = db<AssessmentRow>(TABLE);
    if (query.name?.trim()) {
      q.whereILike("contact_name", `%${query.name.trim()}%`);
    }
    if (query.email?.trim()) {
      q.whereILike("contact_email", `%${query.email.trim()}%`);
    }
    if (query.from?.trim()) {
      q.where("created_at", ">=", query.from);
    }
    if (query.to?.trim()) {
      q.where("created_at", "<=", query.to);
    }

    const countRow = await q.clone().count<{ count: string }>("id as count").first();
    const rows = await q
      .clone()
      .orderBy("updated_at", query.order)
      .offset((query.page - 1) * query.limit)
      .limit(query.limit);

    return { rows, total: Number(countRow?.count ?? 0) };
  },
};
