import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("package_purchases", (table) => {
    table.text("id").primary();
    table.text("customer_name").notNullable();
    table.text("customer_email").notNullable();
    table.text("stripe_session_id").notNullable().unique();
    table.text("stripe_payment_intent_id").nullable();
    table.integer("amount").notNullable();
    table.text("currency").notNullable().defaultTo("usd");
    table.text("package_name").notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("package_purchases");
}
