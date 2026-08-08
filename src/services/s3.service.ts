import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env";
import { S3FileModel, type S3FileRow } from "../models/s3-file.model";
import { AppError, NotFoundError, ValidationError } from "../utils/errors";
import { createS3FileId } from "../utils/id";

export type UploadS3FileInput = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
};

export type UploadS3FileResult = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export type ResumeContent = {
  fileId: string;
  originalName: string;
  mimeType: string;
  signedUrl: string;
  text: string;
  base64: string;
};

function getS3Client(): S3Client {
  if (!env.aws.accessKeyId || !env.aws.secretAccessKey || !env.aws.bucket) {
    throw new AppError(
      "AWS S3 is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET.",
      500,
    );
  }

  return new S3Client({
    region: env.aws.region,
    credentials: {
      accessKeyId: env.aws.accessKeyId,
      secretAccessKey: env.aws.secretAccessKey,
    },
  });
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    const text =
      typeof result === "string"
        ? result
        : ((result as { text?: string }).text ?? "");
    return text.trim();
  } catch (error) {
    throw new AppError(
      `Failed to extract PDF text: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
      500,
    );
  }
}

export const S3Service = {
  async upload(input: UploadS3FileInput): Promise<UploadS3FileResult> {
    if (!input.buffer?.length) {
      throw new ValidationError("File is required");
    }

    if (input.mimeType !== "application/pdf") {
      throw new ValidationError("Only PDF uploads are supported");
    }

    const maxBytes = env.aws.maxUploadBytes;
    if (input.size > maxBytes) {
      throw new ValidationError(
        `File exceeds max size of ${Math.floor(maxBytes / (1024 * 1024))}MB`,
      );
    }

    const id = createS3FileId();
    const key = `resumes/${id}/${sanitizeFileName(input.originalName || "resume.pdf")}`;
    const client = getS3Client();

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: env.aws.bucket,
          Key: key,
          Body: input.buffer,
          ContentType: input.mimeType,
          Metadata: {
            originalName: input.originalName,
            fileId: id,
          },
        }),
      );
    } catch (error) {
      throw new AppError(
        `Failed to upload file to S3: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
        500,
      );
    }

    const row = await S3FileModel.create({
      id,
      bucket: env.aws.bucket,
      key,
      originalName: input.originalName || "resume.pdf",
      mimeType: input.mimeType,
      size: input.size,
    });

    return {
      id: row.id,
      originalName: row.original_name,
      mimeType: row.mime_type,
      size: Number(row.size),
    };
  },

  async getSignedUrl(file: S3FileRow, expiresInSeconds = 60 * 10): Promise<string> {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: file.bucket,
      Key: file.key,
    });

    try {
      return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    } catch (error) {
      throw new AppError(
        `Failed to create signed URL: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
        500,
      );
    }
  },

  async getResumeContent(fileId: string): Promise<ResumeContent> {
    const file = await S3FileModel.findById(fileId);
    if (!file) {
      throw new NotFoundError(`Resume file not found: ${fileId}`);
    }

    const signedUrl = await this.getSignedUrl(file);

    let response: Response;
    try {
      response = await fetch(signedUrl);
    } catch (error) {
      throw new AppError(
        `Failed to download resume from signed URL: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
        500,
      );
    }

    if (!response.ok) {
      throw new AppError(
        `Failed to download resume (${response.status})`,
        500,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const text = await extractPdfText(buffer);
    const base64 = buffer.toString("base64");

    return {
      fileId: file.id,
      originalName: file.original_name,
      mimeType: file.mime_type,
      signedUrl,
      text,
      base64,
    };
  },
};
