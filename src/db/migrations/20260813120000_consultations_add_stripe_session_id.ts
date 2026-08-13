import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("consultations", (table) => {
    table.text("stripe_session_id").nullable().unique();
    table.text("stripe_payment_intent_id").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("consultations", (table) => {
    table.dropColumn("stripe_payment_intent_id");
    table.dropColumn("stripe_session_id");
  });
}
