import * as dotenv from "dotenv";
import * as path from "node:path";

// Load environment variables
const rootDir = process.cwd();
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config({ path: path.join(rootDir, ".env") });

import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";

const emailArg = process.argv[2]?.trim().toLowerCase();

if (!emailArg) {
  console.error("Erro: E-mail não fornecido.");
  console.error("Uso: pnpm plan:grant-pro <email>");
  process.exit(1);
}

async function main() {
  try {
    // 1. Resolve user
    const [targetUser] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, emailArg))
      .limit(1);

    if (!targetUser) {
      console.error(`Erro: Usuário com e-mail "${emailArg}" não foi encontrado no banco de dados.`);
      process.exit(1);
    }

    // 2. Perform idempotent subscription grant in transaction
    await db.transaction(async (tx) => {
      // Inactivate any existing active subscriptions
      await tx
        .update(schema.subscriptions)
        .set({
          status: "inactive",
          endedAt: new Date(),
        })
        .where(
          and(
            eq(schema.subscriptions.userId, targetUser.id),
            eq(schema.subscriptions.status, "active")
          )
        );

      // Insert new active Pro subscription
      await tx.insert(schema.subscriptions).values({
        userId: targetUser.id,
        planCode: "pro",
        status: "active",
        startedAt: new Date(),
      });
    });

    console.log(`[WatchMap Plans] Plano Pro concedido com sucesso para ${targetUser.email} (User ID: ${targetUser.id}).`);
    process.exit(0);
  } catch (error) {
    console.error("[WatchMap Plans] Erro ao conceder plano Pro:", error);
    process.exit(1);
  }
}

main();
