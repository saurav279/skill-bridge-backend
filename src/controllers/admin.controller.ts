import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { AdminService, getAdminCookieOptions } from "../services/admin.service";

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
};
