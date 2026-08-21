import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { InstallmentService } from "../services/installment.service";
import {
  INSTALLMENT_STATUSES,
  PAYMENT_PLAN_STATUSES,
} from "../types/installment";
import { PACKAGE_NAMES } from "../types/packages";

const idParamSchema = z.object({
  id: z.string().min(1),
});

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

const listQueryBase = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  name: z.string().optional(),
  email: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  packageName: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  leadId: z.string().optional(),
  planId: z.string().optional(),
  userId: z.string().optional(),
});

const installmentListQuerySchema = listQueryBase.extend({
  status: z.enum(INSTALLMENT_STATUSES).optional(),
});

const planListQuerySchema = listQueryBase.extend({
  status: z.enum(PAYMENT_PLAN_STATUSES).optional(),
});

const createPaymentPlanSchema = z.object({
  userId: z.string().min(1),
  packageName: z.enum(PACKAGE_NAMES),
  totalAmount: z.number().int().positive(),
  currency: z.enum(["gbp"]).optional(),
  installmentCount: z.number().int().min(2).max(24).optional(),
  intervalDays: z.number().int().min(1).max(365).optional(),
  firstDueAt: dateOnly,
  installments: z
    .array(
      z.object({
        amount: z.number().int().positive(),
        dueAt: dateOnly,
      }),
    )
    .optional(),
});

const checkoutSchema = z.object({
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

const updateInstallmentSchema = z
  .object({
    amount: z.number().int().positive().optional(),
    dueAt: dateOnly.optional(),
    paidOffline: z.boolean().optional(),
  })
  .refine(
    (body) =>
      body.amount !== undefined ||
      body.dueAt !== undefined ||
      body.paidOffline !== undefined,
    { message: "At least one field is required" },
  );

export const InstallmentController = {
  async createPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createPaymentPlanSchema.parse(req.body);
      const result = await InstallmentService.createPlan(body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async listPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const query = planListQuerySchema.parse(req.query);
      const result = await InstallmentService.listPlans(query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getPlanStatusCounts(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await InstallmentService.getPlanStatusCounts();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const result = await InstallmentService.getPlanById(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async cancelPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const result = await InstallmentService.cancelPlan(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = installmentListQuerySchema.parse(req.query);
      const result = await InstallmentService.list(query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getStatusCounts(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await InstallmentService.getStatusCounts();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const result = await InstallmentService.getById(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async createCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const body = checkoutSchema.parse(req.body ?? {});
      const result = await InstallmentService.createCheckout(id, body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async sendEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const body = checkoutSchema.parse(req.body ?? {});
      const result = await InstallmentService.sendCheckoutEmail(id, body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const body = updateInstallmentSchema.parse(req.body);
      const result = await InstallmentService.update(id, body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
