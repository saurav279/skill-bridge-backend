import { db } from "../db/knex";

export type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  lives_in_uk: boolean;
  current_visa: string | null;
  prefered: string | null;
  subject: string;
  message: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type CreateContactMessageInput = {
  id: string;
  name: string;
  email: string;
  phone: string;
  livesInUk: boolean;
  currentVisa?: string | null;
  prefered: "phone" | "google_meet";
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
        phone: input.phone,
        lives_in_uk: input.livesInUk,
        current_visa: input.currentVisa ?? null,
        prefered: input.prefered,
        subject: input.subject,
        message: input.message,
      })
      .returning("*");

    return row;
  },
};
