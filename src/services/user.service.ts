import { LeadModel } from "../models/lead.model";
import { UserModel, type UserRow } from "../models/user.model";
import type { AdminListQuery, AdminListResponse } from "../types/admin";
import { NotFoundError, ValidationError } from "../utils/errors";
import { createUserId } from "../utils/id";

export type UserItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  leadId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateUserBody = {
  name: string;
  email: string;
  phone?: string | null;
  leadId?: string | null;
};

export type UpdateUserBody = {
  name?: string;
  email?: string;
  phone?: string | null;
  leadId?: string | null;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function paginated<T>(
  data: T[],
  total: number,
  query: AdminListQuery,
): AdminListResponse<T> {
  return {
    data,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
  };
}

function mapUser(row: UserRow): UserItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    leadId: row.lead_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

async function assertLeadIfPresent(leadId: string | null): Promise<void> {
  if (!leadId) {
    return;
  }
  const lead = await LeadModel.findById(leadId);
  if (!lead) {
    throw new NotFoundError("Lead not found");
  }
}

export const UserService = {
  async create(body: CreateUserBody): Promise<UserItem> {
    const email = body.email.trim().toLowerCase();
    const existing = await UserModel.findByEmail(email);
    if (existing) {
      throw new ValidationError("Email already in use");
    }

    const leadId = emptyToNull(body.leadId);
    await assertLeadIfPresent(leadId);

    

    const row = await UserModel.create({
      id: createUserId(),
      name: body.name.trim(),
      email,
      phone: emptyToNull(body.phone),
      leadId,
    });
    return mapUser(row);
  },

  async list(query: AdminListQuery): Promise<AdminListResponse<UserItem>> {
    const { rows, total } = await UserModel.listForAdmin(query);
    return paginated(rows.map(mapUser), total, query);
  },

  async getById(id: string): Promise<UserItem> {
    const row = await UserModel.findById(id);
    if (!row) {
      throw new NotFoundError("User not found");
    }
    return mapUser(row);
  },

  async update(id: string, body: UpdateUserBody): Promise<UserItem> {
    const existing = await UserModel.findById(id);
    if (!existing) {
      throw new NotFoundError("User not found");
    }

    if (
      body.name === undefined &&
      body.email === undefined &&
      body.phone === undefined &&
      body.leadId === undefined
    ) {
      throw new ValidationError("At least one field is required");
    }

    if (body.email !== undefined) {
      const email = body.email.trim().toLowerCase();
      const taken = await UserModel.findByEmail(email);
      if (taken && taken.id !== id) {
        throw new ValidationError("Email already in use");
      }
    }

    const leadId =
      body.leadId !== undefined ? emptyToNull(body.leadId) : undefined;
    if (leadId !== undefined) {
      await assertLeadIfPresent(leadId);
    }

    const row = await UserModel.update(id, {
      name: body.name !== undefined ? body.name.trim() : undefined,
      email: body.email !== undefined ? body.email.trim().toLowerCase() : undefined,
      phone: body.phone !== undefined ? emptyToNull(body.phone) : undefined,
      leadId,
    });
    if (!row) {
      throw new NotFoundError("User not found");
    }
    return mapUser(row);
  },
};
