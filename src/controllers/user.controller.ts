import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { UserService } from "../services/user.service";

const idParamSchema = z.object({
  id: z.string().min(1),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  name: z.string().optional(),
  email: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  from: z.string().optional(),
  to: z.string().optional(),
  leadId: z.string().optional(),
});

const optionalLeadId = z
  .union([z.string().min(1), z.literal("")])
  .nullable()
  .optional();

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  leadId: optionalLeadId,
});

const updateUserSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().nullable().optional(),
    leadId: optionalLeadId,
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.email !== undefined ||
      body.phone !== undefined ||
      body.leadId !== undefined,
    { message: "At least one field is required" },
  );

export const UserController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createUserSchema.parse(req.body);
      const result = await UserService.create(body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listQuerySchema.parse(req.query);
      const result = await UserService.list(query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const result = await UserService.getById(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const body = updateUserSchema.parse(req.body);
      const result = await UserService.update(id, body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
