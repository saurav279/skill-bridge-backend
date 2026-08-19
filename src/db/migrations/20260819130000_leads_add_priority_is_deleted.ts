import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("leads", (table) => {
    table.text("priority").nullable();
    table.boolean("is_deleted").notNullable().defaultTo(false);
    table.index("is_deleted");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("leads", (table) => {
    table.dropIndex("is_deleted");
    table.dropColumn("priority");
    table.dropColumn("is_deleted");
  });
}
