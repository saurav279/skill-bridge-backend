import { ulid } from "ulid";

export function createAssessmentId(): string {
  return `ea_${ulid()}`;
}

export function createS3FileId(): string {
  return `sf_${ulid()}`;
}

export function createPackagePurchaseId(): string {
  return `pp_${ulid()}`;
}

export function createContactMessageId(): string {
  return `cm_${ulid()}`;
}

export function createUnsubscribeId(): string {
  return `un_${ulid()}`;
}

export function createConsultationId(): string {
  return `cs_${ulid()}`;
}
