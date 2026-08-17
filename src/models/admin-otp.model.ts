import { db } from "../db/knex";

export type AdminOtpRow = {
  id: string;
  email: string;
  otp_hash: string;
  expires_at: Date | string;
  attempts: number;
  created_at: Date | string;
  updated_at: Date | string;
};

const TABLE = "admin_otps";

export const AdminOtpModel = {
  async upsert(input: {
    id: string;
    email: string;
    otpHash: string;
    expiresAt: Date;
  }): Promise<AdminOtpRow> {
    const [row] = await db<AdminOtpRow>(TABLE)
      .insert({
        id: input.id,
        email: input.email,
        otp_hash: input.otpHash,
        expires_at: input.expiresAt,
        attempts: 0,
      })
      .onConflict("email")
      .merge({
        otp_hash: input.otpHash,
        expires_at: input.expiresAt,
        attempts: 0,
        updated_at: db.fn.now(),
      })
      .returning("*");

    return row;
  },

  async findByEmail(email: string): Promise<AdminOtpRow | undefined> {
    return db<AdminOtpRow>(TABLE).where({ email }).first();
  },

  async incrementAttempts(email: string): Promise<AdminOtpRow | undefined> {
    const [row] = await db<AdminOtpRow>(TABLE)
      .where({ email })
      .increment("attempts", 1)
      .returning("*");

    return row;
  },

  async deleteByEmail(email: string): Promise<number> {
    return db<AdminOtpRow>(TABLE).where({ email }).del();
  },
};
