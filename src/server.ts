import { createApp } from "./app";
import { env } from "./config/env";
import { startEmailWorker } from "./workers/email.worker";

const app = createApp();

startEmailWorker();

app.listen(env.port, "0.0.0.0", () => {
  console.log(`Skill Bridge API listening on port ${env.port}`);
});
