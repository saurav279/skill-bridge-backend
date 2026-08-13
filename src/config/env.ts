import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: requireEnv(
    "DATABASE_URL",
    "postgres://postgres:postgres@localhost:5432/skill_bridge",
  ),

  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
    baseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    referer: process.env.OPENROUTER_REFERER ?? "https://skillbridge.co.uk",
    title: process.env.OPENROUTER_TITLE ?? "SkillBridge-Local",
  },
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? "Skill Bridge <noreply@skillbridge.local>",
  },
  aws: {
    region: process.env.AWS_REGION ?? "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    bucket: process.env.AWS_S3_BUCKET ?? "",
    maxUploadBytes: Number(
      process.env.AWS_MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024,
    ),
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    prices: {
      A: process.env.STRIPE_PRICE_A ?? "",
      B: process.env.STRIPE_PRICE_B ?? "",
      C: process.env.STRIPE_PRICE_C ?? "",
    },
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET ?? "",
    maxUploadBytes: Number(
      process.env.AWS_MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024,
    ),
  },
  admin: {
    email: process.env.ADMIN_EMAIL ?? "",
  },
  google: {
    calendar: {
      clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL ?? "",
      privateKey: (
        process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ??
        process.env.GOOGLE_SERVICE_ACCOUNT_PRVIATE_KEY ??
        ""
      )
        .replace(/\\n/g, "\n")
        .replace(/^"|"$/g, ""),
      timeZone: process.env.GOOGLE_CALENDAR_TIMEZONE ?? "Europe/London",
    },
  },
  frontendUrl: (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  ),
};
