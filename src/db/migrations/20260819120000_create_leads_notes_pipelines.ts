import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("leads", (table) => {
    table.text("id").primary();
    table.text("name").notNullable();
    table.text("email").notNullable();
    table.text("phone").notNullable();
    table.text("secondary_email").nullable();
    table.text("secondary_phone").nullable();
    table.timestamps(true, true);
    table.index("email");
  });

  await knex.schema.createTable("notes", (table) => {
    table.text("id").primary();
    table.text("lead_id").notNullable();
    table.text("note").notNullable();
    table.text("noted_by").notNullable();
    table.timestamps(true, true);
    table
      .foreign("lead_id")
      .references("id")
      .inTable("leads")
      .onDelete("CASCADE");
    table.index("lead_id");
  });

  await knex.schema.createTable("pipelines", (table) => {
    table.text("id").primary();
    table.text("lead_id").notNullable();
    table.text("status").notNullable();
    table.timestamps(true, true);
    table
      .foreign("lead_id")
      .references("id")
      .inTable("leads")
      .onDelete("CASCADE");
    table.index("lead_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("pipelines");
  await knex.schema.dropTableIfExists("notes");
  await knex.schema.dropTableIfExists("leads");
}
