import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AssessmentService } from "../services/assessment.service";
import type { AssessPayload } from "../types/assessment";
import { sendEmail } from "../services/email.service";
import { assessmentEmailTemplate } from "../email-templates/assessment";

const fileMetaSchema = z.object({
  name: z.string(),
  size: z.number(),
  type: z.string(),
});

const answerValueSchema = z.union([
  z.string(),
  z.array(z.string()),
  fileMetaSchema,
  z.tuple([]),
]);

const sectionSchema = z.record(z.string(), answerValueSchema);

const createAssessmentSchema = z
  .object({
    routeId: z.enum(["digital-technology", "academia", "arts"]),
    resumeFileId: z.string().min(1).optional().nullable(),

  })
  .catchall(z.union([z.string(), sectionSchema]));

const idParamSchema = z.object({
  id: z.string().min(1),
});

const emailBodySchema = z.object({
  email: z.string().email().optional(),
});

export const AssessmentsController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {

      const body = createAssessmentSchema.parse(req.body);
      const { resumeFileId, ...rest } = body;  
      const payload = rest as AssessPayload;
      const report = await AssessmentService.create(payload, resumeFileId);

      //send email to the user
      if (report.customerEmail) {
        await sendEmail({
          to: report.customerEmail as string,
          subject: "Your Skill Bridge Assessment Report",
          body: assessmentEmailTemplate(report),
        });
      }
      res.status(201).json(report);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const report = await AssessmentService.getById(id);
      res.status(200).json(report);
    } catch (error) {
      next(error);
    }
  },

  async email(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const body = emailBodySchema.parse(req.body ?? {});
      const result = await AssessmentService.emailReport(id, body.email);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
