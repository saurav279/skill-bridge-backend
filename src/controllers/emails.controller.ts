import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { UnsubscribeService } from "../services/unsubscribe.service";

const emailBodySchema = z.object({
  email: z.string().email(),
});

export const EmailsController = {
  async unsubscribe(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = emailBodySchema.parse(req.body);
      const result = await UnsubscribeService.unsubscribeByEmail(email);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async subscribe(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = emailBodySchema.parse(req.body);
      const result = await UnsubscribeService.subscribeByEmail(email);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
