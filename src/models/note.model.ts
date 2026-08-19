import { db } from "../db/knex";

export type NoteRow = {
  id: string;
  lead_id: string;
  note: string;
  noted_by: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type CreateNoteInput = {
  id: string;
  leadId: string;
  note: string;
  notedBy: string;
};

export type UpdateNoteInput = {
  note?: string;
  notedBy?: string;
};

const TABLE = "notes";

export const NoteModel = {
  async create(input: CreateNoteInput): Promise<NoteRow> {
    const [row] = await db<NoteRow>(TABLE)
      .insert({
        id: input.id,
        lead_id: input.leadId,
        note: input.note,
        noted_by: input.notedBy,
      })
      .returning("*");

    return row;
  },

  async findById(id: string): Promise<NoteRow | undefined> {
    return db<NoteRow>(TABLE).where({ id }).first();
  },

  async listByLeadId(leadId: string): Promise<NoteRow[]> {
    return db<NoteRow>(TABLE).where({ lead_id: leadId }).orderBy("created_at", "asc");
  },

  async update(id: string, input: UpdateNoteInput): Promise<NoteRow | undefined> {
    const patch: Partial<Pick<NoteRow, "note" | "noted_by">> = {};
    if (input.note !== undefined) {
      patch.note = input.note;
    }
    if (input.notedBy !== undefined) {
      patch.noted_by = input.notedBy;
    }

    const [row] = await db<NoteRow>(TABLE).where({ id }).update(patch).returning("*");
    return row;
  },
};
