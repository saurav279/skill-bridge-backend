import { db } from "../db/knex";

export type UnsubscribeRow = {
  id: string;
  email: string;
  created_at: Date | string;
  updated_at: Date | string;
};

const TABLE = "unsubscribes";

export const UnsubscribeModel = {
  async findByEmail(email: string): Promise<UnsubscribeRow | undefined> {
    return db<UnsubscribeRow>(TABLE).where({ email }).first();
  },

  async create(input: {
    id: string;
    email: string;
  }): Promise<UnsubscribeRow> {
    const [row] = await db<UnsubscribeRow>(TABLE)
      .insert({
        id: input.id,
        email: input.email,
      })
      .onConflict("email")
      .ignore()
      .returning("*");

    if (row) return row;

    const existing = await this.findByEmail(input.email);
    if (!existing) {
      throw new Error(`Failed to create unsubscribe for ${input.email}`);
    }
    return existing;
  },

  async deleteByEmail(email: string): Promise<number> {
    return db<UnsubscribeRow>(TABLE).where({ email }).del();
  },
};
