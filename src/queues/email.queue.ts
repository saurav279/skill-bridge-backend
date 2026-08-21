import { Queue } from "bullmq";
import { createRedisConnection } from "../config/redis";

export type EmailJobData = {
  subject: string;
  body: string;
  to: string;
};

export const emailQueue = new Queue<EmailJobData>("emails", {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: true,
  },
});

export async function queueEmail(data: EmailJobData): Promise<void> {
  await emailQueue.add("send-email", data);
}
