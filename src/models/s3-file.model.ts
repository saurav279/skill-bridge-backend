import { db } from "../db/knex";

export type S3FileRow = {
  id: string;
  bucket: string;
  key: string;
  original_name: string;
  mime_type: string;
  size: number | string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type CreateS3FileInput = {
  id: string;
  bucket: string;
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
};

const TABLE = "s3_files";

export const S3FileModel = {
  async create(input: CreateS3FileInput): Promise<S3FileRow> {
    const [row] = await db<S3FileRow>(TABLE)
      .insert({
        id: input.id,
        bucket: input.bucket,
        key: input.key,
        original_name: input.originalName,
        mime_type: input.mimeType,
        size: input.size,
      })
      .returning("*");

    return row;
  },

  async findById(id: string): Promise<S3FileRow | undefined> {
    return db<S3FileRow>(TABLE).where({ id }).first();
  },
};
