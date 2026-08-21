import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("payment_plans", (table) => {
    table.renameColumn("interval_months", "interval_days");
  });

  await knex("payment_plans").update({
    interval_days: knex.raw("interval_days * 30"),
  });

  await knex.schema.alterTable("payment_plans", (table) => {
    table.integer("interval_days").notNullable().defaultTo(60).alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex("payment_plans").update({
    interval_days: knex.raw("GREATEST(1, ROUND(interval_days / 30.0))"),
  });

  await knex.schema.alterTable("payment_plans", (table) => {
    table.renameColumn("interval_days", "interval_months");
  });

  await knex.schema.alterTable("payment_plans", (table) => {
    table.integer("interval_months").notNullable().defaultTo(2).alter();
  });
}
