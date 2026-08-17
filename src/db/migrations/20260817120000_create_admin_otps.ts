import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("admin_otps", (table) => {
    table.text("id").primary();
    table.text("email").notNullable().unique();
    table.text("otp_hash").notNullable();
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table.integer("attempts").notNullable().defaultTo(0);
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("admin_otps");
}
