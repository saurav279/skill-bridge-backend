import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { AssessmentService } from "../services/assessment.service";
import type { AssessPayload } from "../types/assessment";
import { sendEmail } from "../services/email.service";
import {
  adminAssessmentEmailTemplate,
  assessmentEmailTemplate,
} from "../email-templates/assessment";

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
    resumeLink: z.string().min(1).optional().nullable(),

  })
  .catchall(z.union([z.string(), sectionSchema]));

const idParamSchema = z.object({
  id: z.string().min(1),
});

const emailBodySchema = z.object({
  email: z.string().email().optional(),
});

function stringField(
  personal: unknown,
  key: string,
): string | undefined {
  if (!personal || typeof personal !== "object" || Array.isArray(personal)) {
    return undefined;
  }
  const value = (personal as Record<string, unknown>)[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return undefined;
}

function currentVisaFromPersonal(personal: unknown): string | undefined {
  const normalized = stringField(personal, "currentVisa");
  if (normalized) {
    return normalized;
  }
  const visa = stringField(personal, "personalDetails_ukVisa");
  if (!visa || visa === "Others") {
    return stringField(personal, "personalDetails_ukVisaOther");
  }
  return visa;
}

function livesInUkFromPersonal(personal: unknown): string | undefined {
  const raw = stringField(personal, "personalDetails_livesInUk");
  if (raw) {
    return raw;
  }
  if (!personal || typeof personal !== "object" || Array.isArray(personal)) {
    return undefined;
  }
  const livesInUk = (personal as Record<string, unknown>).livesInUk;
  if (typeof livesInUk === "boolean") {
    return livesInUk ? "Yes" : "No";
  }
  return undefined;
}

export const AssessmentsController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {

      const body = createAssessmentSchema.parse(req.body);
      const { resumeLink, ...rest } = body;
      const payload = rest as AssessPayload;
      const report = await AssessmentService.create(payload, resumeLink);

      const personal = payload.personalDetails;
      const livesInUK = livesInUkFromPersonal(personal);
      const currentVisa = currentVisaFromPersonal(personal);
      const storedResumeLink =
        resumeLink?.trim() ||
        (typeof payload.resumeLink === "string" ? payload.resumeLink : undefined);

      if (report.customerEmail) {
        await sendEmail({
          to: report.customerEmail,
          subject: "Your Skill Bridge Assessment Report",
          body: assessmentEmailTemplate(report),
        });
      }

      if (env.admin.email.trim()) {
        await sendEmail({
          to: env.admin.email,
          subject: "New Assessment Report",
          body: adminAssessmentEmailTemplate({
            assessment: report,
            livesInUK,
            currentVisa,
            resumeLink: storedResumeLink,
          }),
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
