import * as dotenv from "dotenv";
import * as path from "node:path";

const rootDir = process.cwd();
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config({ path: path.join(rootDir, ".env") });

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  getActivePlanForUser,
  requireActivePlanForUser,
} from "@/lib/plans/access";
import {
  createRedeemCode,
  redeemCodeForUser,
  hashRedeemCode,
} from "@/lib/plans/redeem";

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    testsPassed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log("=== STARTING SPEC 028 REDEEM CODES TEST SUITE ===\n");

  const testUser1Id = `user_redeem_1_${Date.now()}`;
  const testUser1Email = `user1_${Date.now()}@evandro.watch`;
  const testUser2Id = `user_redeem_2_${Date.now()}`;
  const testUser2Email = `user2_${Date.now()}@evandro.watch`;

  try {
    // 0. Setup test users
    console.log("0. Setting up test users...");
    await db.insert(schema.user).values({
      id: testUser1Id,
      name: "Test User 1",
      email: testUser1Email,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(schema.user).values({
      id: testUser2Id,
      name: "Test User 2",
      email: testUser2Email,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("Users created successfully.\n");

    // 1. Geração de código
    console.log("1. Teste: Geração de código de resgate");
    const codeResult = await createRedeemCode({ durationDays: 30, planCode: "pro" });
    assert(
      codeResult.code.startsWith("EVN-") && codeResult.code.split("-").length === 4,
      `Código gerado tem formato EVN-XXXX-XXXX-XXXX (${codeResult.code})`
    );
    assert(
      codeResult.durationDays === 30,
      "Duração definida corretamente para 30 dias"
    );

    // Verify database only has hash and NOT plain code
    const [storedCodeRow] = await db
      .select()
      .from(schema.redeemCodes)
      .where(eq(schema.redeemCodes.id, codeResult.id))
      .limit(1);

    assert(
      storedCodeRow.codeHash === hashRedeemCode(codeResult.code),
      "Código armazenado como hash SHA-256 no banco"
    );
    assert(
      storedCodeRow.usedAt === null && storedCodeRow.usedByUserId === null,
      "Código novo não está marcado como utilizado"
    );

    // 2. Rejeição de código inválido
    console.log("\n2. Teste: Rejeição de código inválido");
    const invalidRedeem = await redeemCodeForUser(testUser1Id, "EVN-INVALID-CODE-XXXX");
    assert(
      !invalidRedeem.success && invalidRedeem.error === "Código inválido ou já utilizado.",
      "Código inválido é rejeitado com mensagem genérica segura"
    );

    // 3. Resgate válido
    console.log("\n3. Teste: Resgate válido de código de 30 dias");
    const initialPlanUser1 = await getActivePlanForUser(testUser1Id);
    assert(initialPlanUser1 === null, "Usuário 1 inicialmente não tem plano");

    const validRedeem = await redeemCodeForUser(testUser1Id, codeResult.code);
    assert(validRedeem.success, "Resgate do código executado com sucesso");

    const activePlanUser1 = await getActivePlanForUser(testUser1Id);
    assert(activePlanUser1 !== null, "Usuário 1 agora tem plano Pro ativo");
    assert(activePlanUser1?.plan.code === "pro", "Plano atribuído é Pro");
    assert(
      activePlanUser1?.subscription.expiresAt !== null &&
        activePlanUser1?.subscription.expiresAt !== undefined,
      "Subscription possui expiresAt preenchido"
    );

    // Verify redeem code row is marked as used
    const [usedCodeRow] = await db
      .select()
      .from(schema.redeemCodes)
      .where(eq(schema.redeemCodes.id, codeResult.id))
      .limit(1);
    assert(
      usedCodeRow.usedAt !== null && usedCodeRow.usedByUserId === testUser1Id,
      "Código marcado como utilizado com usedAt e usedByUserId"
    );

    // 4. Rejeição de código já usado
    console.log("\n4. Teste: Rejeição de código já utilizado");
    const secondUserRedeem = await redeemCodeForUser(testUser2Id, codeResult.code);
    assert(
      !secondUserRedeem.success && secondUserRedeem.error === "Código inválido ou já utilizado.",
      "Tentativa de reutilizar código usado é rejeitada"
    );

    // 5. Bloqueio de usuário com plano ativo
    console.log("\n5. Teste: Bloqueio de usuário que já possui plano ativo");
    const code2Result = await createRedeemCode({ durationDays: 15 });
    const user1SecondAttempt = await redeemCodeForUser(testUser1Id, code2Result.code);
    assert(
      !user1SecondAttempt.success &&
        user1SecondAttempt.error === "Você já possui um plano ativo.",
      "Usuário com plano ativo não pode resgatar outro código"
    );

    // 6. Expiração de acesso
    console.log("\n6. Teste: Expiração de acesso");
    // Manually set subscription expiresAt to past date (1 hour ago)
    await db
      .update(schema.subscriptions)
      .set({
        expiresAt: new Date(Date.now() - 3600 * 1000),
      })
      .where(eq(schema.subscriptions.userId, testUser1Id));

    const expiredPlan = await getActivePlanForUser(testUser1Id);
    assert(expiredPlan === null, "Usuário com expiresAt no passado é tratado como sem plano");

    let threwExpired = false;
    try {
      await requireActivePlanForUser(testUser1Id);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "NO_ACTIVE_PLAN") {
        threwExpired = true;
      }
    }
    assert(
      threwExpired,
      "requireActivePlanForUser lança NO_ACTIVE_PLAN para assinatura expirada"
    );

    // Now user 1 (with expired plan) CAN redeem a new code!
    console.log("\n7. Teste: Usuário expirado pode resgatar novo código");
    const user1ExpiredRedeem = await redeemCodeForUser(testUser1Id, code2Result.code);
    assert(
      user1ExpiredRedeem.success,
      "Usuário que estava expirado resgatou novo código com sucesso"
    );

    const renewedPlan = await getActivePlanForUser(testUser1Id);
    assert(renewedPlan !== null, "Usuário voltou a ter plano Pro ativo");

    // 8. Assinatura sem expiresAt (permanente) continua válida enquanto status = active
    console.log("\n8. Teste: Assinatura com expiresAt = null");
    await db.insert(schema.subscriptions).values({
      userId: testUser2Id,
      planCode: "pro",
      status: "active",
      startedAt: new Date(),
      expiresAt: null,
    });
    const user2Plan = await getActivePlanForUser(testUser2Id);
    assert(
      user2Plan !== null && user2Plan.subscription.expiresAt === null,
      "Subscription sem expiresAt é válida enquanto status = active"
    );

    // 9. Concorrência no resgate do mesmo código
    console.log("\n9. Teste: Concorrência no resgate do mesmo código");
    const concurrentCode = await createRedeemCode({ durationDays: 7 });

    const testUser3Id = `user_redeem_3_${Date.now()}`;
    const testUser4Id = `user_redeem_4_${Date.now()}`;
    await db.insert(schema.user).values({
      id: testUser3Id,
      name: "Concurrent User 3",
      email: `u3_${Date.now()}@evandro.watch`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(schema.user).values({
      id: testUser4Id,
      name: "Concurrent User 4",
      email: `u4_${Date.now()}@evandro.watch`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const [resA, resB] = await Promise.all([
      redeemCodeForUser(testUser3Id, concurrentCode.code),
      redeemCodeForUser(testUser4Id, concurrentCode.code),
    ]);

    const successCount = (resA.success ? 1 : 0) + (resB.success ? 1 : 0);
    assert(
      successCount === 1,
      `Exatamente 1 usuário obteve sucesso no resgate concorrente (successCount=${successCount})`
    );

    // Cleanup
    console.log("\nCleaning up test users...");
    await db.delete(schema.user).where(eq(schema.user.id, testUser1Id));
    await db.delete(schema.user).where(eq(schema.user.id, testUser2Id));
    await db.delete(schema.user).where(eq(schema.user.id, testUser3Id));
    await db.delete(schema.user).where(eq(schema.user.id, testUser4Id));
    console.log("Cleanup finished.");
  } catch (error) {
    console.error("Test execution failed with error:", error);
    testsFailed++;
  } finally {
    console.log(`\n=== RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED ===\n`);
    if (testsFailed > 0) {
      process.exit(1);
    }
  }
}

runTests();
