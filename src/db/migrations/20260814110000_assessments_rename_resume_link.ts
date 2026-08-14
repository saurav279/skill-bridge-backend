import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable("assessments");
  if (!hasTable) return;

  const hasResumeFileId = await knex.schema.hasColumn(
    "assessments",
    "resume_file_id",
  );
  const hasResumeLink = await knex.schema.hasColumn("assessments", "resume_link");

  if (hasResumeFileId && !hasResumeLink) {
    await knex.raw(
      "ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_resume_file_id_foreign",
    );
    await knex.schema.alterTable("assessments", (table) => {
      table.renameColumn("resume_file_id", "resume_link");
    });
  } else if (!hasResumeLink) {
    await knex.schema.alterTable("assessments", (table) => {
      table.text("resume_link").nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable("assessments");
  if (!hasTable) return;

  const hasResumeLink = await knex.schema.hasColumn("assessments", "resume_link");
  if (hasResumeLink) {
    await knex.schema.alterTable("assessments", (table) => {
      table.renameColumn("resume_link", "resume_file_id");
    });
  }
}
