import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

// app.listen(env.port, () => {
//   console.info(
//     `Skill Bridge API listening on http://localhost:${env.port}`,
//   );
// });

app.listen(env.port, "0.0.0.0", () => {
  console.log(`Skill Bridge API listening on port ${env.port}`);
});