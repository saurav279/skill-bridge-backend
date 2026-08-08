import type { Knex } from "knex";

/**
 * Safe alter for databases that already ran the earlier assessments schema
 * (with email_sent, without resume_file_id).
 */
export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable("assessments");
  if (!hasTable) return;

  const hasEmailSent = await knex.schema.hasColumn("assessments", "email_sent");
  if (hasEmailSent) {
    await knex.schema.alterTable("assessments", (table) => {
      table.dropColumn("email_sent");
    });
  }

  const hasResumeFileId = await knex.schema.hasColumn(
    "assessments",
    "resume_file_id",
  );
  if (!hasResumeFileId) {
    await knex.schema.alterTable("assessments", (table) => {
      table.text("resume_file_id").nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable("assessments");
  if (!hasTable) return;

  const hasResumeFileId = await knex.schema.hasColumn(
    "assessments",
    "resume_file_id",
  );
  if (hasResumeFileId) {
    await knex.schema.alterTable("assessments", (table) => {
      table.dropColumn("resume_file_id");
    });
  }

  const hasEmailSent = await knex.schema.hasColumn("assessments", "email_sent");
  if (!hasEmailSent) {
    await knex.schema.alterTable("assessments", (table) => {
      table.boolean("email_sent").notNullable().defaultTo(false);
    });
  }
}
