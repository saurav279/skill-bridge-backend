import { db } from "../db/knex";

export type ConsultationRow = {
  id: string;
  name: string;
  email: string;
  start_time: Date | string;
  end_time: Date | string;
  package_name: string;
  price: number;
  calendar_event_id: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type CreateConsultationInput = {
  id: string;
  name: string;
  email: string;
  startTime: Date;
  endTime: Date;
  packageName: string;
  price: number;
  calendarEventId?: string | null;
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
};

const TABLE = "consultations";

export const ConsultationModel = {
  async create(input: CreateConsultationInput): Promise<ConsultationRow> {
    const [row] = await db<ConsultationRow>(TABLE)
      .insert({
        id: input.id,
        name: input.name,
        email: input.email,
        start_time: input.startTime,
        end_time: input.endTime,
        package_name: input.packageName,
        price: input.price,
        calendar_event_id: input.calendarEventId ?? null,
        stripe_session_id: input.stripeSessionId ?? null,
        stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
      })
      .returning("*");

    return row;
  },

  async findBySessionId(
    stripeSessionId: string,
  ): Promise<ConsultationRow | undefined> {
    return db<ConsultationRow>(TABLE)
      .where({ stripe_session_id: stripeSessionId })
      .first();
  },
};
