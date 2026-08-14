import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("consultations", (table) => {
    table.text("phone").notNullable().defaultTo("");
    table.boolean("lives_in_uk").notNullable().defaultTo(false);
    table.text("current_visa").nullable();
  });

  await knex.schema.alterTable("contact_messages", (table) => {
    table.text("phone").notNullable().defaultTo("");
    table.boolean("lives_in_uk").notNullable().defaultTo(false);
    table.text("current_visa").nullable();
    table.text("prefered").nullable();
  });

  await knex.schema.alterTable("assessments", (table) => {
    table.text("phone").nullable();
    table.boolean("lives_in_uk").nullable();
    table.text("current_visa").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("consultations", (table) => {
    table.dropColumn("phone");
    table.dropColumn("lives_in_uk");
    table.dropColumn("current_visa");
  });

  await knex.schema.alterTable("contact_messages", (table) => {
    table.dropColumn("phone");
    table.dropColumn("lives_in_uk");
    table.dropColumn("current_visa");
    table.dropColumn("prefered");
  });

  await knex.schema.alterTable("assessments", (table) => {
    table.dropColumn("phone");
    table.dropColumn("lives_in_uk");
    table.dropColumn("current_visa");
  });
}
