import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("assessments"))) return;

  if (await knex.schema.hasColumn("assessments", "lives_in_uk")) {
    await knex.schema.alterTable("assessments", (table) => {
      table.dropColumn("lives_in_uk");
    });
  }

  if (await knex.schema.hasColumn("assessments", "current_visa")) {
    await knex.schema.alterTable("assessments", (table) => {
      table.dropColumn("current_visa");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("assessments"))) return;

  if (!(await knex.schema.hasColumn("assessments", "lives_in_uk"))) {
    await knex.schema.alterTable("assessments", (table) => {
      table.boolean("lives_in_uk").nullable();
    });
  }

  if (!(await knex.schema.hasColumn("assessments", "current_visa"))) {
    await knex.schema.alterTable("assessments", (table) => {
      table.text("current_visa").nullable();
    });
  }
}
