import { Worker } from "bullmq";
import { createRedisConnection } from "../config/redis";
import type { EmailJobData } from "../queues/email.queue";
import { sendEmail } from "../services/email.service";

export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    "emails",
    async (job) => {
      await sendEmail(job.data);
    },
    { connection: createRedisConnection() },
  );

  worker.on("completed", (job) => {
    console.log(`[email-worker]: ✅ sent job ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[email-worker]: ❌ job ${job?.id} failed`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[email-worker]: connection error", err.message);
  });

  return worker;
}
