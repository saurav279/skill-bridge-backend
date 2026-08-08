import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("s3_files", (table) => {
    table.text("id").primary();
    table.text("bucket").notNullable();
    table.text("key").notNullable().unique();
    table.text("original_name").notNullable();
    table.text("mime_type").notNullable();
    table.bigInteger("size").notNullable();
    table.timestamps(true, true);
  });

  await knex.schema.alterTable("assessments", (table) => {
    table
      .foreign("resume_file_id")
      .references("id")
      .inTable("s3_files")
      .onDelete("SET NULL");
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasAssessments = await knex.schema.hasTable("assessments");
  if (hasAssessments) {
    const hasResumeFileId = await knex.schema.hasColumn(
      "assessments",
      "resume_file_id",
    );
    if (hasResumeFileId) {
      await knex.schema.alterTable("assessments", (table) => {
        table.dropForeign(["resume_file_id"]);
      });
    }
  }

  await knex.schema.dropTableIfExists("s3_files");
}
