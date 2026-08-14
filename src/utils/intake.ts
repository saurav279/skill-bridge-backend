import { z } from "zod";

const E164_PHONE = /^\+[1-9]\d{1,14}$/;

export const intakeSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .regex(E164_PHONE, "phone must be E.164, e.g. +447123456789"),
    livesInUk: z.boolean(),
    currentVisa: z.string().trim().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.livesInUk === false && data.currentVisa !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "currentVisa must be omitted when livesInUk is false",
        path: ["currentVisa"],
      });
    }
  });

export type IntakeFields = z.infer<typeof intakeSchema>;

export function formatLivesInUk(livesInUk: boolean): string {
  return livesInUk ? "Yes" : "No";
}

export function formatCurrentVisa(
  livesInUk: boolean,
  currentVisa?: string | null,
): string {
  if (!livesInUk) {
    return "—";
  }
  const value = currentVisa?.trim();
  return value ? value : "—";
}
