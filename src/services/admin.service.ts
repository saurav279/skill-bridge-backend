import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AdminOtpModel } from "../models/admin-otp.model";
import { AssessmentModel, type AssessmentRow } from "../models/assessment.model";
import {
  ContactMessageModel,
  type ContactMessageRow,
} from "../models/contact-message.model";
import {
  PackagePurchaseModel,
  type PackagePurchaseRow,
} from "../models/package-purchase.model";
import type { AdminListQuery, AdminListResponse } from "../types/admin";
import { NotFoundError, UnauthorizedError, ValidationError } from "../utils/errors";
import { createAdminOtpId } from "../utils/id";
import { sendAdminOtpEmail } from "./email.service";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const ADMIN_TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export type AdminAssessmentListItem = {
  id: string;
  routeId: string;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  resumeLink: string | null;
  confidenceScore: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminAssessmentDetail = AdminAssessmentListItem & {
  payload: AssessmentRow["payload"];
  report: AssessmentRow["report"];
};

export type AdminContactMessage = {
  id: string;
  name: string;
  email: string;
  phone: string;
  livesInUk: boolean;
  currentVisa: string | null;
  prefered: string | null;
  subject: string;
  message: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminPackagePurchase = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  amount: number;
  currency: string;
  packageName: string;
  createdAt: string;
  updatedAt: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function paginated<T>(
  data: T[],
  total: number,
  query: AdminListQuery,
): AdminListResponse<T> {
  return {
    data,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
  };
}

function mapAssessmentListItem(row: AssessmentRow): AdminAssessmentListItem {
  return {
    id: row.id,
    routeId: row.route_id,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    phone: row.phone,
    resumeLink: row.resume_link,
    confidenceScore: row.confidence_score,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapAssessmentDetail(row: AssessmentRow): AdminAssessmentDetail {
  return {
    ...mapAssessmentListItem(row),
    payload: row.payload,
    report: row.report,
  };
}

function mapContactMessage(row: ContactMessageRow): AdminContactMessage {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    livesInUk: row.lives_in_uk,
    currentVisa: row.current_visa,
    prefered: row.prefered,
    subject: row.subject,
    message: row.message,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapPackagePurchase(row: PackagePurchaseRow): AdminPackagePurchase {
  return {
    id: row.id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    stripeSessionId: row.stripe_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    amount: row.amount,
    currency: row.currency,
    packageName: row.package_name,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function getAdminCookieOptions() {
  const isProd = env.nodeEnv === "production";
  const crossOrigin = isProd || env.frontendUrl.includes("localhost");
  return {
    httpOnly: true,
    secure: crossOrigin,
    sameSite: (crossOrigin ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: ADMIN_TOKEN_MAX_AGE_MS,
  };
}

export const AdminService = {
  async login(email: string, password: string): Promise<{ message: string }> {
    const loginEmail = normalizeEmail(env.admin.loginEmail);
    const loginPassword = env.admin.password;
    if (!loginEmail || !loginPassword) {
      throw new ValidationError("Admin login is not configured.");
    }

    const emailOk = safeEqual(normalizeEmail(email), loginEmail);
    const passwordOk = safeEqual(password, loginPassword);
    if (!emailOk || !passwordOk) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const otp = crypto.randomInt(100000, 1_000_000).toString();
    await AdminOtpModel.upsert({
      id: createAdminOtpId(),
      email: loginEmail,
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    await sendAdminOtpEmail(otp);
    return { message: "OTP sent" };
  },

  async verifyOtp(email: string, otp: string): Promise<{ token: string }> {
    if (!env.admin.jwtSecret) {
      throw new ValidationError("Admin JWT is not configured.");
    }

    const loginEmail = normalizeEmail(env.admin.loginEmail);
    if (!safeEqual(normalizeEmail(email), loginEmail)) {
      throw new UnauthorizedError("Invalid or expired OTP");
    }

    const pending = await AdminOtpModel.findByEmail(loginEmail);
    if (!pending || new Date(pending.expires_at).getTime() < Date.now()) {
      await AdminOtpModel.deleteByEmail(loginEmail);
      throw new UnauthorizedError("Invalid or expired OTP");
    }

    const updated = await AdminOtpModel.incrementAttempts(loginEmail);
    if (!updated || updated.attempts > OTP_MAX_ATTEMPTS) {
      await AdminOtpModel.deleteByEmail(loginEmail);
      throw new UnauthorizedError("Invalid or expired OTP");
    }

    if (!safeEqual(hashOtp(otp), updated.otp_hash)) {
      throw new UnauthorizedError("Invalid or expired OTP");
    }

    await AdminOtpModel.deleteByEmail(loginEmail);

    const token = jwt.sign(
      { sub: "admin", email: loginEmail },
      env.admin.jwtSecret,
      { expiresIn: "7d" },
    );

    return { token };
  },

  verifyAdminToken(token: string): void {
    if (!env.admin.jwtSecret) {
      throw new UnauthorizedError();
    }
    try {
      jwt.verify(token, env.admin.jwtSecret);
    } catch {
      throw new UnauthorizedError();
    }
  },

  async listAssessments(
    query: AdminListQuery,
  ): Promise<AdminListResponse<AdminAssessmentListItem>> {
    const { rows, total } = await AssessmentModel.listForAdmin(query);
    return paginated(rows.map(mapAssessmentListItem), total, query);
  },

  async getAssessment(id: string): Promise<AdminAssessmentDetail> {
    const row = await AssessmentModel.findById(id);
    if (!row) {
      throw new NotFoundError("Assessment not found");
    }
    return mapAssessmentDetail(row);
  },

  async listContactMessages(
    query: AdminListQuery,
  ): Promise<AdminListResponse<AdminContactMessage>> {
    const { rows, total } = await ContactMessageModel.listForAdmin(query);
    return paginated(rows.map(mapContactMessage), total, query);
  },

  async getContactMessage(id: string): Promise<AdminContactMessage> {
    const row = await ContactMessageModel.findById(id);
    if (!row) {
      throw new NotFoundError("Contact message not found");
    }
    return mapContactMessage(row);
  },

  async listPackagePurchases(
    query: AdminListQuery,
  ): Promise<AdminListResponse<AdminPackagePurchase>> {
    const { rows, total } = await PackagePurchaseModel.listForAdmin(query);
    console.log("query", query);
    return paginated(rows.map(mapPackagePurchase), total, query);
  },

  async getPackagePurchase(id: string): Promise<AdminPackagePurchase> {
    const row = await PackagePurchaseModel.findById(id);
    if (!row) {
      throw new NotFoundError("Package purchase not found");
    }
    return mapPackagePurchase(row);
  },
};
