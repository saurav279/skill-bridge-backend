import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { CalendarService } from "../services/calendar.service";
import { StripeService } from "../services/stripe.service";

const availableSlotsQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
  difference: z.preprocess(
    (value) => (value === undefined || value === "" ? undefined : Number(value)),
    z
      .number()
      .int()
      .refine((value) => value === 15 || value === 30 || value === 60, {
        message: "difference must be 15, 30, or 60",
      })
      .optional(),
  ),
});

const calendarStripeSchema = z
  .object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    name: z.string().trim().min(1),
    email: z.string().trim().email(),
    description: z.string().trim().min(1),
    packageName: z.enum(["A", "B", "C"]),
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const CalendarController = {
  async availableSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const query = availableSlotsQuerySchema.parse(req.query);
      const result = await CalendarService.getAvailableSlots(
        query.date,
        query.difference,
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async createStripeCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const body = calendarStripeSchema.parse(req.body);
      const { url } = await StripeService.createCalendarCheckoutSession(body);
      res.status(201).json({ url });
    } catch (error) {
      next(error);
    }
  },
};
