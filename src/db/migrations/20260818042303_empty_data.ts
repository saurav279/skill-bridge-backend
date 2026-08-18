import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex('admin_otps').truncate();
    await knex('assessments').truncate();
    await knex('consultations').truncate();
    await knex('contact_messages').truncate();
    await knex('package_purchases').truncate();
    await knex('s3_files').truncate();
    await knex('unsubscribes').truncate();
}

export async function down(knex: Knex): Promise<void> {
}