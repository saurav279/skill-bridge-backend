import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ContactService } from "../services/contact.service";
import { intakeSchema } from "../utils/intake";

const contactUsSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email(),
    subject: z.string().min(1),
    message: z.string().min(1),
    prefered: z.enum(["phone", "email"]),
  })
  .and(intakeSchema);

export const PublicController = {
  async contactUs(req: Request, res: Response, next: NextFunction) {
    try {
      const body = contactUsSchema.parse(req.body);
      const result = await ContactService.submit(body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
