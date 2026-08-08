import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("assessments", (table) => {
    table.text("id").primary();
    table.text("route_id").notNullable();
    table.text("contact_name").nullable();
    table.text("contact_email").nullable();
    table.text("resume_file_id").nullable();
    table.jsonb("payload").notNullable();
    table.jsonb("report").notNullable();
    table.integer("confidence_score").notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("assessments");
}
