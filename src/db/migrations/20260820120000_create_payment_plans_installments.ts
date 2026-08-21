import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("payment_plans", (table) => {
    table.text("id").primary();
    table.text("lead_id").nullable();
    table.text("customer_name").notNullable();
    table.text("customer_email").notNullable();
    table.text("customer_phone").nullable();
    table.text("package_name").notNullable();
    table.integer("total_amount").notNullable();
    table.text("currency").notNullable().defaultTo("gbp");
    table.integer("installment_count").notNullable();
    table.integer("interval_months").notNullable().defaultTo(2);
    table.date("first_due_at").notNullable();
    table.timestamp("cancelled_at", { useTz: true }).nullable();
    table.timestamps(true, true);

    table
      .foreign("lead_id")
      .references("id")
      .inTable("leads")
      .onDelete("SET NULL");
    table.index("lead_id");
    table.index("customer_email");
    table.index("package_name");
  });

  await knex.schema.createTable("installments", (table) => {
    table.text("id").primary();
    table.text("plan_id").notNullable();
    table.integer("sequence").notNullable();
    table.integer("amount").notNullable();
    table.date("due_at").notNullable();
    table.text("status").notNullable().defaultTo("upcoming");
    table.text("stripe_session_id").nullable().unique();
    table.text("stripe_payment_intent_id").nullable();
    table.text("stripe_checkout_url").nullable();
    table.timestamp("checkout_expires_at", { useTz: true }).nullable();
    table.timestamp("link_sent_at", { useTz: true }).nullable();
    table.timestamp("paid_at", { useTz: true }).nullable();
    table.timestamp("failed_at", { useTz: true }).nullable();
    table.boolean("paid_offline").notNullable().defaultTo(false);
    table.timestamps(true, true);

    table
      .foreign("plan_id")
      .references("id")
      .inTable("payment_plans")
      .onDelete("CASCADE");
    table.unique(["plan_id", "sequence"]);
    table.index("plan_id");
    table.index("due_at");
    table.index("status");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("installments");
  await knex.schema.dropTableIfExists("payment_plans");
}
