import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.port, () => {
  console.info(
    `Skill Bridge API listening on http://localhost:${env.port}`,
  );
});
