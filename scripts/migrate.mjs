import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import dotenv from "dotenv";

const envFile = process.env.ENV_FILE || ".env.local";
dotenv.config({ path: envFile });
dotenv.config();

if (typeof globalThis.WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}


const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL não configurada.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const db = drizzle(pool);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ Migrations sincronizadas com sucesso.");
} catch (error) {
  console.error("Erro ao aplicar migrations:", error);
  process.exit(1);
} finally {
  await pool.end();
}
