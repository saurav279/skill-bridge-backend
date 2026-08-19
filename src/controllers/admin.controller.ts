import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { AdminService, getAdminCookieOptions } from "../services/admin.service";
import { LeadService } from "../services/lead.service";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const otpSchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/, "otp must be a 6-digit code"),
});

const idParamSchema = z.object({
  id: z.string().min(1),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  name: z.string().optional(),
  email: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  packageName: z.string().optional(),
});

const optionalEmail = z
  .union([z.string().email(), z.literal("")])
  .nullable()
  .optional();

const optionalPriority = z.string().nullable().optional();

const createLeadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  secondaryEmail: optionalEmail,
  secondaryPhone: z.string().nullable().optional(),
  priority: optionalPriority,
  pipelineStatus: z.string().nullable().optional(),
});

const updateLeadSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(1).optional(),
    secondaryEmail: optionalEmail,
    secondaryPhone: z.string().nullable().optional(),
    priority: optionalPriority,
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.email !== undefined ||
      body.phone !== undefined ||
      body.secondaryEmail !== undefined ||
      body.secondaryPhone !== undefined ||
      body.priority !== undefined,
    { message: "At least one field is required" },
  );

const createPipelineSchema = z.object({
  leadId: z.string().min(1),
  status: z.string().min(1),
});

const createNoteSchema = z.object({
  leadId: z.string().min(1),
  note: z.string().min(1),
  notedBy: z.string().min(1),
});

const updateNoteSchema = z
  .object({
    note: z.string().min(1).optional(),
    notedBy: z.string().min(1).optional(),
  })
  .refine((body) => body.note !== undefined || body.notedBy !== undefined, {
    message: "At least one of note or notedBy is required",
  });

export const AdminController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const body = loginSchema.parse(req.body);
      const result = await AdminService.login(body.email, body.password);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const body = otpSchema.parse(req.body);
      const { token } = await AdminService.verifyOtp(body.email, body.otp);
      res.cookie("admin_token", token, getAdminCookieOptions());
      res.status(200).json({ message: "Logged in" });
    } catch (error) {
      next(error);
    }
  },

  async listAssessments(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listQuerySchema.parse(req.query);
      const result = await AdminService.listAssessments(query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getAssessment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const result = await AdminService.getAssessment(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async listContactMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listQuerySchema.parse(req.query);
      const result = await AdminService.listContactMessages(query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getContactMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const result = await AdminService.getContactMessage(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async listPackagePurchases(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listQuerySchema.parse(req.query);
      const result = await AdminService.listPackagePurchases(query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getPackagePurchase(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const result = await AdminService.getPackagePurchase(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async createLead(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createLeadSchema.parse(req.body);
      const result = await LeadService.create(body);
   
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async listLeads(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listQuerySchema.parse(req.query);
      const result = await LeadService.list(query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getLead(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const result = await LeadService.getById(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getLeadStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await LeadService.getStatusCounts();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async updateLead(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const body = updateLeadSchema.parse(req.body);
      const result = await LeadService.update(id, body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async deleteLead(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const result = await LeadService.softDelete(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async createPipeline(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createPipelineSchema.parse(req.body);
      const result = await LeadService.createPipeline(body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async createNote(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createNoteSchema.parse(req.body);
      const result = await LeadService.createNote(body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async updateNote(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const body = updateNoteSchema.parse(req.body);
      const result = await LeadService.updateNote(id, body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
