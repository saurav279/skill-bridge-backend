import type { Knex } from "knex";
import dotenv from "dotenv";

dotenv.config();

const connection =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/skill_bridge";

const shared: Knex.Config = {
  client: "pg",
  connection,
  migrations: {
    directory: "./src/db/migrations",
    extension: "ts",
    tableName: "knex_migrations",
  },
};

const config: { [key: string]: Knex.Config } = {
  development: shared,
  production: {
    ...shared,
    pool: { min: 2, max: 10 },
  },
};

export default config;
