import * as dotenv from "dotenv";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { Pool, neonConfig } from "@neondatabase/serverless";

const rootDir = process.cwd();
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config({ path: path.join(rootDir, ".env") });

if (typeof globalThis.WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Erro: DATABASE_URL não configurada.");
  process.exit(1);
}

const pool = new Pool({ connectionString });

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    testsPassed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    testsFailed++;
  }
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode() {
  const getBlock = (len) => {
    const bytes = crypto.randomBytes(len);
    let s = "";
    for (let i = 0; i < len; i++) {
      s += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    }
    return s;
  };
  return `EVN-${getBlock(4)}-${getBlock(4)}-${getBlock(4)}`;
}

function hashCode(code) {
  const norm = code.trim().toUpperCase();
  return crypto.createHash("sha256").update(norm).digest("hex");
}

async function createRedeemCodeDirect(durationDays, planCode = "pro") {
  const rawCode = generateCode();
  const codeHash = hashCode(rawCode);
  const id = crypto.randomUUID();

  await pool.query(
    `INSERT INTO redeem_codes (id, code_hash, plan_code, duration_days, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [id, codeHash, planCode, durationDays]
  );

  return { id, code: rawCode, codeHash, durationDays, planCode };
}

async function redeemCodeDirect(userId, rawCode) {
  if (!rawCode || typeof rawCode !== "string") {
    return { success: false, error: "Código inválido ou já utilizado." };
  }

  const codeHash = hashCode(rawCode);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Check active subscription
    const activeSubRes = await client.query(
      `SELECT id FROM subscriptions
       WHERE user_id = $1 AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [userId]
    );

    if (activeSubRes.rows.length > 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Você já possui um plano ativo." };
    }

    // 2. Lock redeem code
    const codeRes = await client.query(
      `SELECT id, plan_code, duration_days FROM redeem_codes
       WHERE code_hash = $1 AND used_at IS NULL
       FOR UPDATE`,
      [codeHash]
    );

    if (codeRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Código inválido ou já utilizado." };
    }

    const codeRow = codeRes.rows[0];
    const durationDays = codeRow.duration_days;

    // 3. Inactivate old active subscriptions
    await client.query(
      `UPDATE subscriptions SET status = 'inactive', ended_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    // 4. Insert new subscription with expiration
    await client.query(
      `INSERT INTO subscriptions (id, user_id, plan_code, status, started_at, expires_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'active', NOW(), NOW() + ($3 || ' days')::interval, NOW(), NOW())`,
      [userId, codeRow.plan_code, durationDays]
    );

    // 5. Mark redeem code as used
    const updateRes = await client.query(
      `UPDATE redeem_codes SET used_at = NOW(), used_by_user_id = $1
       WHERE id = $2 AND used_at IS NULL
       RETURNING id`,
      [userId, codeRow.id]
    );

    if (updateRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Código inválido ou já utilizado." };
    }

    await client.query("COMMIT");
    return { success: true };
  } catch {
    await client.query("ROLLBACK");
    return { success: false, error: "Código inválido ou já utilizado." };
  } finally {
    client.release();
  }
}

async function getActiveSubscriptionDirect(userId) {
  const res = await pool.query(
    `SELECT * FROM subscriptions
     WHERE user_id = $1 AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return res.rows[0] || null;
}

async function runTests() {
  console.log("=== STARTING SPEC 028 REDEEM CODES TEST SUITE ===\n");

  const testUser1Id = `user_test_1_${Date.now()}`;
  const testUser2Id = `user_test_2_${Date.now()}`;

  try {
    // 0. Setup test users
    console.log("0. Setting up test users...");
    await pool.query(
      `INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, true, NOW(), NOW())`,
      [testUser1Id, "Test User 1", `u1_${Date.now()}@evandro.watch`]
    );
    await pool.query(
      `INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, true, NOW(), NOW())`,
      [testUser2Id, "Test User 2", `u2_${Date.now()}@evandro.watch`]
    );
    console.log("Users created successfully.\n");

    // 1. Geração de código
    console.log("1. Teste: Geração de código de resgate");
    const codeResult = await createRedeemCodeDirect(30, "pro");
    assert(
      codeResult.code.startsWith("EVN-") && codeResult.code.split("-").length === 4,
      `Código gerado tem formato EVN-XXXX-XXXX-XXXX (${codeResult.code})`
    );
    assert(
      codeResult.durationDays === 30,
      "Duração definida corretamente para 30 dias"
    );

    // Verify database only has hash and NOT plain code
    const storedRes = await pool.query(
      `SELECT * FROM redeem_codes WHERE id = $1`,
      [codeResult.id]
    );
    const storedCodeRow = storedRes.rows[0];

    assert(
      storedCodeRow.code_hash === hashCode(codeResult.code),
      "Código armazenado como hash SHA-256 no banco"
    );
    assert(
      storedCodeRow.used_at === null && storedCodeRow.used_by_user_id === null,
      "Código novo não está marcado como utilizado"
    );

    // 2. Rejeição de código inválido
    console.log("\n2. Teste: Rejeição de código inválido");
    const invalidRedeem = await redeemCodeDirect(testUser1Id, "EVN-INVALID-CODE-XXXX");
    assert(
      !invalidRedeem.success && invalidRedeem.error === "Código inválido ou já utilizado.",
      "Código inválido é rejeitado com mensagem genérica segura"
    );

    // 3. Resgate válido
    console.log("\n3. Teste: Resgate válido de código de 30 dias");
    const initialPlanUser1 = await getActiveSubscriptionDirect(testUser1Id);
    assert(initialPlanUser1 === null, "Usuário 1 inicialmente não tem plano");

    const validRedeem = await redeemCodeDirect(testUser1Id, codeResult.code);
    assert(validRedeem.success, "Resgate do código executado com sucesso");

    const activePlanUser1 = await getActiveSubscriptionDirect(testUser1Id);
    assert(activePlanUser1 !== null, "Usuário 1 agora tem plano Pro ativo");
    assert(activePlanUser1.plan_code === "pro", "Plano atribuído é Pro");
    assert(
      activePlanUser1.expires_at !== null && activePlanUser1.expires_at !== undefined,
      `Subscription possui expires_at preenchido (${activePlanUser1.expires_at})`
    );

    // Verify redeem code row is marked as used
    const usedCodeRes = await pool.query(
      `SELECT * FROM redeem_codes WHERE id = $1`,
      [codeResult.id]
    );
    const usedCodeRow = usedCodeRes.rows[0];
    assert(
      usedCodeRow.used_at !== null && usedCodeRow.used_by_user_id === testUser1Id,
      "Código marcado como utilizado com used_at e used_by_user_id"
    );

    // 4. Rejeição de código já usado
    console.log("\n4. Teste: Rejeição de código já utilizado");
    const secondUserRedeem = await redeemCodeDirect(testUser2Id, codeResult.code);
    assert(
      !secondUserRedeem.success && secondUserRedeem.error === "Código inválido ou já utilizado.",
      "Tentativa de reutilizar código usado é rejeitada"
    );

    // 5. Bloqueio de usuário com plano ativo
    console.log("\n5. Teste: Bloqueio de usuário que já possui plano ativo");
    const code2Result = await createRedeemCodeDirect(15);
    const user1SecondAttempt = await redeemCodeDirect(testUser1Id, code2Result.code);
    assert(
      !user1SecondAttempt.success &&
        user1SecondAttempt.error === "Você já possui um plano ativo.",
      "Usuário com plano ativo não pode resgatar outro código"
    );

    // 6. Expiração de acesso
    console.log("\n6. Teste: Expiração de acesso");
    await pool.query(
      `UPDATE subscriptions SET expires_at = NOW() - INTERVAL '1 hour' WHERE user_id = $1`,
      [testUser1Id]
    );

    const expiredPlan = await getActiveSubscriptionDirect(testUser1Id);
    assert(expiredPlan === null, "Usuário com expires_at no passado é tratado como sem plano");

    // 7. Usuário expirado resgata novo código
    console.log("\n7. Teste: Usuário expirado pode resgatar novo código");
    const user1ExpiredRedeem = await redeemCodeDirect(testUser1Id, code2Result.code);
    assert(
      user1ExpiredRedeem.success,
      "Usuário que estava expirado resgatou novo código com sucesso"
    );

    const renewedPlan = await getActiveSubscriptionDirect(testUser1Id);
    assert(renewedPlan !== null, "Usuário voltou a ter plano Pro ativo");

    // 8. Assinatura sem expires_at (permanente)
    console.log("\n8. Teste: Assinatura com expires_at = null");
    await pool.query(
      `INSERT INTO subscriptions (id, user_id, plan_code, status, started_at, expires_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'pro', 'active', NOW(), NULL, NOW(), NOW())`,
      [testUser2Id]
    );
    const user2Plan = await getActiveSubscriptionDirect(testUser2Id);
    assert(
      user2Plan !== null && user2Plan.expires_at === null,
      "Subscription sem expires_at é válida enquanto status = active"
    );

    // 9. Concorrência no resgate do mesmo código
    console.log("\n9. Teste: Concorrência no resgate do mesmo código");
    const concurrentCode = await createRedeemCodeDirect(7);

    const testUser3Id = `user_test_3_${Date.now()}`;
    const testUser4Id = `user_test_4_${Date.now()}`;
    await pool.query(
      `INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
       VALUES ($1, 'U3', $2, true, NOW(), NOW()), ($3, 'U4', $4, true, NOW(), NOW())`,
      [testUser3Id, `u3_${Date.now()}@evandro.watch`, testUser4Id, `u4_${Date.now()}@evandro.watch`]
    );

    const [resA, resB] = await Promise.all([
      redeemCodeDirect(testUser3Id, concurrentCode.code),
      redeemCodeDirect(testUser4Id, concurrentCode.code),
    ]);

    const successCount = (resA.success ? 1 : 0) + (resB.success ? 1 : 0);
    assert(
      successCount === 1,
      `Exatamente 1 usuário obteve sucesso no resgate concorrente (successCount=${successCount})`
    );

    // Cleanup
    console.log("\nCleaning up test users...");
    await pool.query(`DELETE FROM "user" WHERE id IN ($1, $2, $3, $4)`, [
      testUser1Id,
      testUser2Id,
      testUser3Id,
      testUser4Id,
    ]);
    console.log("Cleanup finished.");
  } catch (error) {
    console.error("Test execution failed with error:", error);
    testsFailed++;
  } finally {
    await pool.end();
    console.log(`\n=== RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED ===\n`);
    if (testsFailed > 0) {
      process.exit(1);
    }
  }
}

runTests();
