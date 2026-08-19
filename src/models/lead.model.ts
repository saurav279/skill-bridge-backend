import { db } from "../db/knex";
import type { AdminListQuery } from "../types/admin";

export type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  secondary_email: string | null;
  secondary_phone: string | null;
  priority: string | null;
  is_deleted: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

export type LeadListRow = LeadRow & {
  latest_status: string | null;
  total_note_count: string | number;
  last_note: string | null;
  last_note_created_at: Date | string | null;
};

export type CreateLeadInput = {
  id: string;
  name: string;
  email: string;
  phone: string;
  secondaryEmail?: string | null;
  secondaryPhone?: string | null;
  priority?: string | null;
};

export type UpdateLeadInput = {
  name?: string;
  email?: string;
  phone?: string;
  secondaryEmail?: string | null;
  secondaryPhone?: string | null;
  priority?: string | null;
};

export type LeadStatusCountsRow = {
  total: number;
  high_priority: number;
  today_count: number;
  week_count: number;
  month_count: number;
};

const TABLE = "leads";

function activeLeads() {
  return db<LeadRow>(TABLE).where({ is_deleted: false });
}

export const LeadModel = {
  async create(input: CreateLeadInput): Promise<LeadRow> {
const existingLead = await this.getLeadByEmail(input.email);
    if(existingLead){
     return existingLead;
    }
    const [row] = await db<LeadRow>(TABLE)
      .insert({
        id: input.id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        secondary_email: input.secondaryEmail ?? null,
        secondary_phone: input.secondaryPhone ?? null,
        priority: input.priority ?? null,
        is_deleted: false,
      })
      .returning("*");

    return row;
  },

  async findById(id: string): Promise<LeadRow | undefined> {
    return activeLeads().where({ id }).first();
  },

  async update(id: string, input: UpdateLeadInput): Promise<LeadRow | undefined> {
    const patch: Partial<LeadRow> = {
      updated_at: db.fn.now() as unknown as Date,
    };
    if (input.name !== undefined) {
      patch.name = input.name;
    }
    if (input.email !== undefined) {
      patch.email = input.email;
    }
    if (input.phone !== undefined) {
      patch.phone = input.phone;
    }
    if (input.secondaryEmail !== undefined) {
      patch.secondary_email = input.secondaryEmail;
    }
    if (input.secondaryPhone !== undefined) {
      patch.secondary_phone = input.secondaryPhone;
    }
    if (input.priority !== undefined) {
      patch.priority = input.priority;
    }

    const [row] = await activeLeads().where({ id }).update(patch).returning("*");
    return row;
  },

  async softDelete(id: string): Promise<LeadRow | undefined> {
    const [row] = await activeLeads()
      .where({ id })
      .update({
        is_deleted: true,
        updated_at: db.fn.now() as unknown as Date,
      })
      .returning("*");
    return row;
  },

  async statusCounts(): Promise<LeadStatusCountsRow> {
    const result = await db.raw<{ rows: LeadStatusCountsRow[] }>(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE lower(priority) = 'high')::int AS high_priority,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS today_count,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS week_count,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS month_count
      FROM leads
      WHERE is_deleted = false
    `);

    return (
      result.rows[0] ?? {
        total: 0,
        high_priority: 0,
        today_count: 0,
        week_count: 0,
        month_count: 0,
      }
    );
  },

  async listForAdmin(
    query: AdminListQuery,
  ): Promise<{ rows: LeadListRow[]; total: number }> {
    const q = activeLeads();

    if (query.name?.trim()) {
      q.whereILike("name", `%${query.name.trim()}%`);
    }
    if (query.email?.trim()) {
      q.whereILike("email", `%${query.email.trim()}%`);
    }

    const countRow = await q.clone().count<{ count: string }>("id as count").first();

    const latestStatus = db("pipelines")
      .select("status")
      .whereRaw("pipelines.lead_id = leads.id")
      .orderBy("created_at", "desc")
      .limit(1);

    const totalNoteCount = db("notes")
      .count("*")
      .whereRaw("notes.lead_id = leads.id");

    const lastNote = db("notes")
      .select("note")
      .whereRaw("notes.lead_id = leads.id")
      .orderBy("created_at", "desc")
      .limit(1);

    const lastNoteCreatedAt = db("notes")
      .select("created_at")
      .whereRaw("notes.lead_id = leads.id")
      .orderBy("created_at", "desc")
      .limit(1);

    const rows = await q
      .clone()
      .select(
        "leads.*",
        latestStatus.as("latest_status"),
        totalNoteCount.as("total_note_count"),
        lastNote.as("last_note"),
        lastNoteCreatedAt.as("last_note_created_at"),
      )
      .orderBy("updated_at", query.order)
      .offset((query.page - 1) * query.limit)
      .limit(query.limit);

    return { rows: rows as LeadListRow[], total: Number(countRow?.count ?? 0) };
  },

  async getLeadIdByEmail(email: string): Promise<string | undefined> {
    const row = await db<LeadRow>(TABLE).where({ email }).first();
    return row?.id ?? undefined;
  },

  async getLeadByEmail(email: string): Promise<LeadRow | undefined> {
    const row = await db<LeadRow>(TABLE).where({ email }).first();
    return row ?? undefined;
  },
};
