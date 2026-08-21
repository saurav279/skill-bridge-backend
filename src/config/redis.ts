import Redis from "ioredis";
import { env } from "./env";

function parseRedisUrl(raw: string): URL {
  let value = raw.trim();

  const assignment = value.match(/^REDIS_URL\s*=\s*(.*)$/i);
  if (assignment) {
    value = assignment[1].trim();
  }

  value = value.replace(/^["']|["']$/g, "");

  const fromCli = value.match(/-u\s+(\S+)/);
  if (fromCli) {
    value = fromCli[1].replace(/^["']|["']$/g, "");
  }

  const embedded = value.match(/rediss?:\/\/\S+/i);
  if (embedded) {
    value = embedded[0].replace(/["']+$/, "");
  }

  return new URL(value);
}

/**
 * Fresh ioredis client for each Queue/Worker.
 * Do not share a single instance between them.
 */
export function createRedisConnection(): Redis {
  const parsed = parseRedisUrl(env.redisUrl);
  const useTls =
    parsed.protocol === "rediss:" || parsed.hostname.endsWith(".upstash.io");

  return new Redis({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username
      ? decodeURIComponent(parsed.username)
      : undefined,
    password: parsed.password
      ? decodeURIComponent(parsed.password)
      : undefined,
    tls: useTls ? {} : undefined,
    maxRetriesPerRequest: null,
  });
}
