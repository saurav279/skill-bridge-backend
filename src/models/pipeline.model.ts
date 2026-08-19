import { db } from "../db/knex";

export type PipelineRow = {
  id: string;
  lead_id: string;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type CreatePipelineInput = {
  id: string;
  leadId: string;
  status: string;
};

const TABLE = "pipelines";

export const PipelineModel = {
  async create(input: CreatePipelineInput): Promise<PipelineRow> {
    const [row] = await db<PipelineRow>(TABLE)
      .insert({
        id: input.id,
        lead_id: input.leadId,
        status: input.status,
      })
      .returning("*");

    return row;
  },

  async listByLeadId(leadId: string): Promise<PipelineRow[]> {
    return db<PipelineRow>(TABLE)
      .where({ lead_id: leadId })
      .orderBy("created_at", "asc");
  },
};
