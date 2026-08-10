import { db } from "../db/knex";

export type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  company: string;
  subject: string;
  message: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type CreateContactMessageInput = {
  id: string;
  name: string;
  email: string;
  company: string;
  subject: string;
  message: string;
};

const TABLE = "contact_messages";

export const ContactMessageModel = {
  async create(input: CreateContactMessageInput): Promise<ContactMessageRow> {
    const [row] = await db<ContactMessageRow>(TABLE)
      .insert({
        id: input.id,
        name: input.name,
        email: input.email,
        company: input.company,
        subject: input.subject,
        message: input.message,
      })
      .returning("*");

    return row;
  },
};
