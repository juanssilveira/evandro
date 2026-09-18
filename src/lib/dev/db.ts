import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "@/db/schema";
import { getAdminEnvironmentConfig, type AdminEnvironment } from "./env-config";

if (typeof globalThis.WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

export type AdminDb = ReturnType<typeof drizzle<typeof schema>>;

const adminPoolCache = new Map<string, Pool>();
const adminDbCache = new Map<string, AdminDb>();

/**
 * Returns a Drizzle client connected strictly to the specified environment's database.
 * Completely isolated from global application db.
 */
export function getAdminDb(env: AdminEnvironment): AdminDb {
  const config = getAdminEnvironmentConfig(env);
  const connectionString = config.DATABASE_URL;

  if (adminDbCache.has(connectionString)) {
    return adminDbCache.get(connectionString)!;
  }

  let pool = adminPoolCache.get(connectionString);
  if (!pool) {
    pool = new Pool({ connectionString });
    adminPoolCache.set(connectionString, pool);
  }

  const client = drizzle(pool, { schema });
  adminDbCache.set(connectionString, client);

  return client;
}
