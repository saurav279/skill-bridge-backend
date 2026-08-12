import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable("contact_messages");
  if (!hasTable) return;

  const hasCompany = await knex.schema.hasColumn("contact_messages", "company");
  if (hasCompany) {
    await knex.schema.alterTable("contact_messages", (table) => {
      table.dropColumn("company");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable("contact_messages");
  if (!hasTable) return;

  const hasCompany = await knex.schema.hasColumn("contact_messages", "company");
  if (!hasCompany) {
    await knex.schema.alterTable("contact_messages", (table) => {
      table.text("company").notNullable().defaultTo("");
    });
  }
}
