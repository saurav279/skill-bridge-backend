import { db } from "../db/knex";
import type { AdminListQuery } from "../types/admin";

export type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  lives_in_uk: boolean;
  current_visa: string | null;
  prefered: string | null;
  subject: string;
  message: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type CreateContactMessageInput = {
  id: string;
  name: string;
  email: string;
  phone: string;
  livesInUk: boolean;
  currentVisa?: string | null;
  prefered: "phone" | "google_meet";
  subject: string;
  message: string;
};

const TABLE = "contact_messages";

export const ContactMessageModel = {
  async create(input: CreateContactMessageInput): Promise<ContactMessageRow> {
    const [row] = await db<ContactMessageRow>(TABLE)
      .insert({
        id: input.id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        lives_in_uk: input.livesInUk,
        current_visa: input.currentVisa ?? null,
        prefered: input.prefered,
        subject: input.subject,
        message: input.message,
      })
      .returning("*");

    return row;
  },

  async findById(id: string): Promise<ContactMessageRow | undefined> {
    return db<ContactMessageRow>(TABLE).where({ id }).first();
  },

  async listForAdmin(
    query: AdminListQuery,
  ): Promise<{ rows: ContactMessageRow[]; total: number }> {
    const q = db<ContactMessageRow>(TABLE);
    if (query.name?.trim()) {
      q.whereILike("name", `%${query.name.trim()}%`);
    }
    if (query.email?.trim()) {
      q.whereILike("email", `%${query.email.trim()}%`);
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
