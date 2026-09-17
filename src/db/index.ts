import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as dotenv from "dotenv";
import * as schema from "./schema";

if (typeof globalThis.WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

if (!process.env.DATABASE_URL) {
  dotenv.config({ path: ".env.local" });
  dotenv.config({ path: ".env" });
}

const connectionString = process.env.DATABASE_URL || "";
const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });
