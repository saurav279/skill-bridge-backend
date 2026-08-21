import type { Knex } from "knex";
import { createUserId } from "../../utils/id";

type LegacyPlan = {
  id: string;
  lead_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
};

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("users", (table) => {
    table.text("id").primary();
    table.text("name").notNullable();
    table.text("email").notNullable().unique();
    table.text("phone").nullable();
    table.text("lead_id").nullable();
    table.timestamps(true, true);

    table
      .foreign("lead_id")
      .references("id")
      .inTable("leads")
      .onDelete("SET NULL");
    table.index("lead_id");
  });

  await knex.schema.alterTable("payment_plans", (table) => {
    table.text("user_id").nullable();
  });

  const plans = await knex<LegacyPlan>("payment_plans").select(
    "id",
    "lead_id",
    "customer_name",
    "customer_email",
    "customer_phone",
  );

  const userIdByEmail = new Map<string, string>();
  for (const plan of plans) {
    const email = plan.customer_email.trim().toLowerCase();
    let userId = userIdByEmail.get(email);
    if (!userId) {
      userId = createUserId();
      await knex("users").insert({
        id: userId,
        name: plan.customer_name,
        email,
        phone: plan.customer_phone,
        lead_id: plan.lead_id,
      });
      userIdByEmail.set(email, userId);
    }
    await knex("payment_plans").where({ id: plan.id }).update({ user_id: userId });
  }

  await knex.schema.alterTable("payment_plans", (table) => {
    table.dropForeign(["lead_id"]);
    table.dropIndex(["lead_id"]);
    table.dropIndex(["customer_email"]);
    table.dropColumn("lead_id");
    table.dropColumn("customer_name");
    table.dropColumn("customer_email");
    table.dropColumn("customer_phone");
  });

  await knex.schema.alterTable("payment_plans", (table) => {
    table.text("user_id").notNullable().alter();
    table
      .foreign("user_id")
      .references("id")
      .inTable("users")
      .onDelete("RESTRICT");
    table.index("user_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("payment_plans", (table) => {
    table.text("lead_id").nullable();
    table.text("customer_name").nullable();
    table.text("customer_email").nullable();
    table.text("customer_phone").nullable();
  });

  const plans = await knex("payment_plans")
    .join("users", "users.id", "payment_plans.user_id")
    .select(
      "payment_plans.id as plan_id",
      "users.name as name",
      "users.email as email",
      "users.phone as phone",
      "users.lead_id as lead_id",
    );

  for (const plan of plans) {
    await knex("payment_plans").where({ id: plan.plan_id }).update({
      lead_id: plan.lead_id,
      customer_name: plan.name,
      customer_email: plan.email,
      customer_phone: plan.phone,
    });
  }

  await knex.schema.alterTable("payment_plans", (table) => {
    table.dropForeign(["user_id"]);
    table.dropIndex(["user_id"]);
    table.dropColumn("user_id");
  });

  await knex.schema.alterTable("payment_plans", (table) => {
    table.text("customer_name").notNullable().alter();
    table.text("customer_email").notNullable().alter();
    table
      .foreign("lead_id")
      .references("id")
      .inTable("leads")
      .onDelete("SET NULL");
    table.index("lead_id");
    table.index("customer_email");
  });

  await knex.schema.dropTableIfExists("users");
}
