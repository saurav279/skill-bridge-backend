import { env } from "../config/env";
import { AppError, ValidationError } from "../utils/errors";

export type UploadCloudinaryInput = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
};

export type UploadCloudinaryResult = {
  secureUrl: string;
};

export const CloudinaryService = {
  async upload(input: UploadCloudinaryInput): Promise<UploadCloudinaryResult> {
    if (!input.buffer?.length) {
      throw new ValidationError("File is required");
    }

    const { cloudName, uploadPreset, maxUploadBytes } = env.cloudinary;
    if (!cloudName || !uploadPreset) {
      throw new AppError("Cloudinary is not configured.", 500);
    }

    if (input.size > maxUploadBytes) {
      throw new ValidationError(
        `File exceeds max size of ${Math.floor(maxUploadBytes / (1024 * 1024))}MB`,
      );
    }

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }),
      input.originalName || "upload",
    );
    formData.append("upload_preset", uploadPreset);

    let response: Response;
    try {
      response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
        {
          method: "POST",
          body: formData,
        },
      );
    } catch (error) {
      throw new AppError(
        `Failed to upload to Cloudinary: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
        500,
      );
    }

    if (!response.ok) {
      let detail = "";
      try {
        const body = (await response.json()) as { error?: { message?: string } };
        detail = body.error?.message ? `: ${body.error.message}` : "";
      } catch {
        // ignore parse errors
      }
      throw new AppError(`Cloudinary upload failed${detail}`, 500);
    }

    const data = (await response.json()) as { secure_url?: string };
    if (!data.secure_url) {
      throw new AppError("Cloudinary upload did not return a secure URL", 500);
    }

    return { secureUrl: data.secure_url };
  },
};
