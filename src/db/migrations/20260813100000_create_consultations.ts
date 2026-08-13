import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("consultations", (table) => {
    table.text("id").primary();
    table.text("name").notNullable();
    table.text("email").notNullable();
    table.timestamp("start_time", { useTz: true }).notNullable();
    table.timestamp("end_time", { useTz: true }).notNullable();
    table.text("package_name").notNullable();
    table.integer("price").notNullable();
    table.text("calendar_event_id").nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("consultations");
}
