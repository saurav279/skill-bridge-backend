import knex, { type Knex } from "knex";
import { env } from "../config/env";

const config: Knex.Config = {
  client: "pg",
  connection: env.databaseUrl,
  pool: { min: 0, max: 10 },
};

export const db = knex(config);
