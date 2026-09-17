import * as dotenv from "dotenv";
import * as path from "node:path";
import { Pool, neonConfig } from "@neondatabase/serverless";

const rootDir = process.cwd();
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config({ path: path.join(rootDir, ".env") });

if (typeof globalThis.WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

const emailArg = process.argv[2]?.trim().toLowerCase();

if (!emailArg) {
  console.error("Erro: E-mail não fornecido.");
  console.error("Uso: pnpm plan:revoke <email>");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Erro: DATABASE_URL não configurada.");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function main() {
  try {
    // 1. Resolve user
    const userRes = await pool.query(
      'SELECT id, name, email FROM "user" WHERE LOWER(email) = $1 LIMIT 1',
      [emailArg]
    );

    if (!userRes.rows || userRes.rows.length === 0) {
      console.error(`Erro: Usuário com e-mail "${emailArg}" não foi encontrado no banco de dados.`);
      process.exit(1);
    }

    const targetUser = userRes.rows[0];

    // 2. Inactivate any active subscriptions
    const updateRes = await pool.query(
      'UPDATE subscriptions SET status = $1, ended_at = NOW(), updated_at = NOW() WHERE user_id = $2 AND status = $3 RETURNING id',
      ["inactive", targetUser.id, "active"]
    );

    const revokedCount = updateRes.rowCount ?? updateRes.rows.length;

    if (revokedCount === 0) {
      console.log(`[WatchMap Plans] O usuário ${targetUser.email} não possuía nenhuma assinatura ativa.`);
    } else {
      console.log(`[WatchMap Plans] Plano revogado com sucesso para ${targetUser.email} (User ID: ${targetUser.id}). Assinaturas inativadas: ${revokedCount}`);
    }
    process.exit(0);
  } catch (error) {
    console.error("[WatchMap Plans] Erro ao revogar plano:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
