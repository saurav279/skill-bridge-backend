import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("contact_messages", (table) => {
    table.text("id").primary();
    table.text("name").notNullable();
    table.text("email").notNullable();
    table.text("subject").notNullable();
    table.text("message").notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("contact_messages");
}
