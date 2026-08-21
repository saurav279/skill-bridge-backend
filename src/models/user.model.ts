import { db } from "../db/knex";
import type { AdminListQuery } from "../types/admin";
import { createNoteId } from "../utils/id";
import { NoteModel } from "./note.model";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  lead_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type CreateUserInput = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  leadId?: string | null;
};

export type UpdateUserInput = {
  name?: string;
  email?: string;
  phone?: string | null;
  leadId?: string | null;
};

const TABLE = "users";

export const UserModel = {
  async create(input: CreateUserInput): Promise<UserRow> {
    const [row] = await db<UserRow>(TABLE)
      .insert({
        id: input.id,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        lead_id: input.leadId ?? null,
      })
      .returning("*");
      if(input.leadId) {
      await NoteModel.create({
        id: createNoteId(),
        leadId: input.leadId,
        note: ` User created for this lead: ${input.name} - ${input.email} - ${input.phone}`,
        notedBy: "System",
      });
    }

    return row;
  },

  async findById(id: string): Promise<UserRow | undefined> {
    return db<UserRow>(TABLE).where({ id }).first();
  },

  async findByEmail(email: string): Promise<UserRow | undefined> {
    return db<UserRow>(TABLE).where({ email: email.trim().toLowerCase() }).first();
  },

  async update(id: string, input: UpdateUserInput): Promise<UserRow | undefined> {
    const patch: Partial<UserRow> = {
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
    if (input.leadId !== undefined) {
      patch.lead_id = input.leadId;
    }

    const [row] = await db<UserRow>(TABLE).where({ id }).update(patch).returning("*");
    return row;
  },

  async findOrCreate(input: Omit<CreateUserInput, "id"> & { id: string }): Promise<UserRow> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.findByEmail(email);
    if (!existing) {
      return this.create({
        id: input.id,
        name: input.name,
        email,
        phone: input.phone ?? null,
        leadId: input.leadId ?? null,
      });
    }

    const nextName = input.name.trim() || existing.name;
    const nextPhone =
      input.phone !== undefined ? (input.phone ?? null) : existing.phone;
    const nextLeadId = existing.lead_id ?? input.leadId ?? null;
    if (
      nextName === existing.name &&
      nextPhone === existing.phone &&
      nextLeadId === existing.lead_id
    ) {
      return existing;
    }

    const updated = await this.update(existing.id, {
      name: nextName,
      phone: nextPhone,
      leadId: nextLeadId,
    });
    return updated ?? existing;
  },

  async listForAdmin(
    query: AdminListQuery,
  ): Promise<{ rows: UserRow[]; total: number }> {
    const q = db<UserRow>(TABLE);

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
    if (query.leadId?.trim()) {
      q.where("lead_id", query.leadId.trim());
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
