import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("package_purchases", (table) => {
        table.string("customer_phone").nullable();
    });
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("package_purchases", (table) => {
        table.dropColumn("customer_phone");
    });
}

