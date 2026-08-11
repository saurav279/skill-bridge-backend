import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const message = err.issues.map((issue) => issue.message).join("; ");
    res.status(400).json({ error: message || "Validation failed" });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name?: string }).name === "MulterError"
  ) {
    const message =
      "message" in err && typeof (err as { message?: unknown }).message === "string"
        ? (err as { message: string }).message
        : "Upload failed";
    res.status(400).json({ error: message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
};
