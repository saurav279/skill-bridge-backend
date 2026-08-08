import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import assessmentsRoutes from "./routes/assessments.routes";
import s3Routes from "./routes/s3.routes";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigins,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use("/services/s3", s3Routes);
  app.use("/assessments", assessmentsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
