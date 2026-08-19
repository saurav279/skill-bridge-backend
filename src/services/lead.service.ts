import { LeadModel, type LeadListRow, type LeadRow } from "../models/lead.model";
import { NoteModel, type NoteRow } from "../models/note.model";
import { PipelineModel, type PipelineRow } from "../models/pipeline.model";
import type { AdminListQuery, AdminListResponse } from "../types/admin";
import { NotFoundError, ValidationError } from "../utils/errors";
import { createLeadId, createNoteId, createPipelineId } from "../utils/id";

export type LeadListItem = {
  id: string;
  name: string;
  email: string;
  phone: string;
  secondaryEmail: string | null;
  secondaryPhone: string | null;
  priority: string | null;
  latestStatus: string | null;
  totalNoteCount: number;
  lastNote: string | null;
  lastNoteCreatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NoteItem = {
  id: string;
  note: string;
  notedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type PipelineItem = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type LeadDetail = {
  id: string;
  name: string;
  email: string;
  phone: string;
  secondaryEmail: string | null;
  secondaryPhone: string | null;
  priority: string | null;
  createdAt: string;
  updatedAt: string;
  pipelines: PipelineItem[];
  notes: NoteItem[];
};

export type LeadStatusCounts = {
  total: number;
  highPriority: number;
  todayCount: number;
  weekCount: number;
  monthCount: number;
};

export type CreateLeadBody = {
  name: string;
  email: string;
  phone: string;
  secondaryEmail?: string | null;
  secondaryPhone?: string | null;
  priority?: string | null;
  status?: string | null;
};

export type UpdateLeadBody = {
  name?: string;
  email?: string;
  phone?: string;
  secondaryEmail?: string | null;
  secondaryPhone?: string | null;
  priority?: string | null;
};

export type CreatePipelineBody = {
  leadId: string;
  status: string;
};

export type CreateNoteBody = {
  leadId: string;
  note: string;
  notedBy: string;
};

export type UpdateNoteBody = {
  note?: string;
  notedBy?: string;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  return toIso(value);
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

function mapLeadListItem(row: LeadListRow): LeadListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    secondaryEmail: row.secondary_email,
    secondaryPhone: row.secondary_phone,
    priority: row.priority,
    latestStatus: row.latest_status,
    totalNoteCount: Number(row.total_note_count ?? 0),
    lastNote: row.last_note,
    lastNoteCreatedAt: toIsoOrNull(row.last_note_created_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapLeadBase(row: LeadRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    secondaryEmail: row.secondary_email,
    secondaryPhone: row.secondary_phone,
    priority: row.priority,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapNote(row: NoteRow): NoteItem {
  return {
    id: row.id,
    note: row.note,
    notedBy: row.noted_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapPipeline(row: PipelineRow): PipelineItem {
  return {
    id: row.id,
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

async function requireLead(leadId: string): Promise<LeadRow> {
  const lead = await LeadModel.findById(leadId);
  if (!lead) {
    throw new NotFoundError("Lead not found");
  }
  return lead;
}

export const LeadService = {
  async create(body: CreateLeadBody): Promise<ReturnType<typeof mapLeadBase>> {
    const row = await LeadModel.create({
      id: createLeadId(),
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone.trim(),
      secondaryEmail: emptyToNull(body.secondaryEmail),
      secondaryPhone: emptyToNull(body.secondaryPhone),
      priority: emptyToNull(body.priority),

    });

    await PipelineModel.create({
      id: createPipelineId(),
      leadId: row.id,
      status: emptyToNull(body.status) ?? "New",
    });
    return mapLeadBase(row);
  },

  async list(query: AdminListQuery): Promise<AdminListResponse<LeadListItem>> {
    const { rows, total } = await LeadModel.listForAdmin(query);
    return paginated(rows.map(mapLeadListItem), total, query);
  },

  async getStatusCounts(): Promise<LeadStatusCounts> {
    const row = await LeadModel.statusCounts();
    return {
      total: Number(row.total ?? 0),
      highPriority: Number(row.high_priority ?? 0),
      todayCount: Number(row.today_count ?? 0),
      weekCount: Number(row.week_count ?? 0),
      monthCount: Number(row.month_count ?? 0),
    };
  },

  async getById(id: string): Promise<LeadDetail> {
    const lead = await requireLead(id);
    const [pipelines, notes] = await Promise.all([
      PipelineModel.listByLeadId(id),
      NoteModel.listByLeadId(id),
    ]);

    return {
      ...mapLeadBase(lead),
      pipelines: pipelines.map(mapPipeline),
      notes: notes.map(mapNote),
    };
  },

  async update(id: string, body: UpdateLeadBody): Promise<ReturnType<typeof mapLeadBase>> {
    if (
      body.name === undefined &&
      body.email === undefined &&
      body.phone === undefined &&
      body.secondaryEmail === undefined &&
      body.secondaryPhone === undefined &&
      body.priority === undefined
    ) {
      throw new ValidationError("At least one field is required");
    }

    await requireLead(id);

    const row = await LeadModel.update(id, {
      name: body.name !== undefined ? body.name.trim() : undefined,
      email: body.email !== undefined ? body.email.trim().toLowerCase() : undefined,
      phone: body.phone !== undefined ? body.phone.trim() : undefined,
      secondaryEmail:
        body.secondaryEmail !== undefined ? emptyToNull(body.secondaryEmail) : undefined,
      secondaryPhone:
        body.secondaryPhone !== undefined ? emptyToNull(body.secondaryPhone) : undefined,
      priority: body.priority !== undefined ? emptyToNull(body.priority) : undefined,
    });
    if (!row) {
      throw new NotFoundError("Lead not found");
    }
    return mapLeadBase(row);
  },

  async softDelete(id: string): Promise<{ message: string }> {
    const row = await LeadModel.softDelete(id);
    if (!row) {
      throw new NotFoundError("Lead not found");
    }
    return { message: "Lead deleted." };
  },

  async createPipeline(body: CreatePipelineBody): Promise<PipelineItem> {
    await requireLead(body.leadId);
    const row = await PipelineModel.create({
      id: createPipelineId(),
      leadId: body.leadId,
      status: body.status.trim(),
    });
    return mapPipeline(row);
  },

  async createNote(body: CreateNoteBody): Promise<NoteItem> {
    await requireLead(body.leadId);
    const row = await NoteModel.create({
      id: createNoteId(),
      leadId: body.leadId,
      note: body.note.trim(),
      notedBy: body.notedBy.trim(),
    });
    return mapNote(row);
  },

  async updateNote(id: string, body: UpdateNoteBody): Promise<NoteItem> {
    if (body.note === undefined && body.notedBy === undefined) {
      throw new ValidationError("At least one of note or notedBy is required");
    }

    const existing = await NoteModel.findById(id);
    if (!existing) {
      throw new NotFoundError("Note not found");
    }

    const row = await NoteModel.update(id, {
      note: body.note !== undefined ? body.note.trim() : undefined,
      notedBy: body.notedBy !== undefined ? body.notedBy.trim() : undefined,
    });
    if (!row) {
      throw new NotFoundError("Note not found");
    }
    return mapNote(row);
  },
};
