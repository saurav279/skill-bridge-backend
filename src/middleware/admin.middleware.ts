import type { NextFunction, Request, Response } from "express";
import { AdminService } from "../services/admin.service";
import { UnauthorizedError } from "../utils/errors";

export function requireAdminAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = req.cookies?.admin_token;
    if (typeof token !== "string" || !token.trim()) {
      throw new UnauthorizedError();
    }
    AdminService.verifyAdminToken(token);
    next();
  } catch (error) {
    next(error instanceof UnauthorizedError ? error : new UnauthorizedError());
  }
}
