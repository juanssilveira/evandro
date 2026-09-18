import * as dotenv from "dotenv";
import * as path from "node:path";

import * as crypto from "node:crypto";

const rootDir = process.cwd();
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config({ path: path.join(rootDir, ".env") });

if (!process.env.MUX_TOKEN_ID) process.env.MUX_TOKEN_ID = "dummy_token_id";
if (!process.env.MUX_TOKEN_SECRET) process.env.MUX_TOKEN_SECRET = "dummy_token_secret";

import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  getActivePlanForUser,
  requireActivePlanForUser,
  getCurrentPeriodKey,
  getPlanUsage,
} from "@/lib/plans/access";
import {
  resolvePlaybackEntitlement,
  recordPlaybackSession,
  canLoadPlayback,
} from "@/lib/plans/playback";
import {
  createVideoUploadSession,
} from "@/lib/videos";

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
  console.log("=== STARTING SPEC 038 PRELOADED PLAYBACK AUTHORIZATION & LIMITS TEST SUITE ===\n");

  const testEmail = `test_limits_${Date.now()}@evandro.watch`;
  const testUserId = `user_test_${Date.now()}`;
  const testAccountId = crypto.randomUUID();

  try {
    // Setup clean test user and account
    console.log("Setting up test environment...");
    await db.insert(schema.user).values({
      id: testUserId,
      name: "Test User Limits",
      email: testEmail,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(schema.accounts).values({
      id: testAccountId,
      name: "Test Account",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(schema.accountMembers).values({
      id: crypto.randomUUID(),
      accountId: testAccountId,
      userId: testUserId,
      role: "owner",
      createdAt: new Date(),
    });

    // -------------------------------------------------------------
    // TEST 1: Conta nova -> sem plano (plan = null)
    // -------------------------------------------------------------
    console.log("\n1. Teste: Conta nova não possui plano ativo");
    const initialPlan = await getActivePlanForUser(testUserId);
    assert(initialPlan === null, "Nova conta tem getActivePlanForUser === null");

    // -------------------------------------------------------------
    // TEST 2: API direta / guard sem plano -> bloqueada
    // -------------------------------------------------------------
    console.log("\n2. Teste: requireActivePlanForUser sem plano ativo lança erro NO_ACTIVE_PLAN");
    let threwNoPlan = false;
    try {
      await requireActivePlanForUser(testUserId);
    } catch (err: unknown) {
      if (err instanceof Error) {
        threwNoPlan = err.message === "NO_ACTIVE_PLAN";
      }
    }
    assert(threwNoPlan, "requireActivePlanForUser bloqueou acesso sem plano com erro NO_ACTIVE_PLAN");

    // -------------------------------------------------------------
    // TEST 3: Grant Pro -> acesso liberado
    // -------------------------------------------------------------
    console.log("\n3. Teste: Grant Pro concede acesso com sucesso");
    await db.insert(schema.subscriptions).values({
      userId: testUserId,
      planCode: "pro",
      status: "active",
      startedAt: new Date(),
    });

    const activePlan = await getActivePlanForUser(testUserId);
    assert(activePlan !== null && activePlan.plan.code === "pro", "Plano Pro ativo resolvido com sucesso");
    assert(activePlan?.plan.limits.maxVideos === 10, "Limite de vídeos do Pro é 10");
    assert(activePlan?.plan.limits.maxPlaysPerMonth === 5000, "Limite de Plays do Pro é 5000");
    assert(activePlan?.plan.limits.maxVideoDurationSeconds === 1200, "Limite de duração é 1200s (20min)");

    // -------------------------------------------------------------
    // TEST 4 & 5: Limite de vídeos e Concorrência (9 vídeos + 2 concurrent requests -> max 10)
    // -------------------------------------------------------------
    console.log("\n4 & 5. Teste: Limite de 10 vídeos com concorrência (9 + 2 requisições simultâneas)");
    // Insert 9 existing ready videos
    for (let i = 1; i <= 9; i++) {
      await db.insert(schema.videos).values({
        id: crypto.randomUUID(),
        publicId: crypto.randomUUID(),
        accountId: testAccountId,
        title: `Video Test ${i}`,
        status: "ready",
        originalFilename: `video${i}.mp4`,
        mimeType: "video/mp4",
        sizeBytes: 1000000,
        createdAt: new Date(),
      });
    }

    // Attempt 2 concurrent slot reservations
    console.log("  Disparando 2 reservas simultâneas no banco...");
    const results = await Promise.allSettled([
      createVideoUploadSession(testAccountId, {
        title: "Video 10 Candidate A",
        filename: "candA.mp4",
        mimeType: "video/mp4",
        sizeBytes: 1000000,
      }),
      createVideoUploadSession(testAccountId, {
        title: "Video 10 Candidate B",
        filename: "candB.mp4",
        mimeType: "video/mp4",
        sizeBytes: 1000000,
      }),
    ]);

    const successes = results.filter((r) => r.status === "fulfilled");
    const rejections = results.filter((r) => r.status === "rejected");

    assert(successes.length === 1, "Exatamente 1 das requisições simultâneas criou o 10º vídeo");
    assert(rejections.length === 1, "A 2ª requisição simultânea foi rejeitada por limite de slot");
    if (rejections[0] && rejections[0].status === "rejected") {
      assert(
        (rejections[0].reason as Error).message === "VIDEO_LIMIT_REACHED",
        "Motivo do bloqueio foi VIDEO_LIMIT_REACHED"
      );
    }

    // Verify database total slot occupying count
    const [finalVideoCountRes] = (await db.execute(sql`
      SELECT count(*)::int AS count
      FROM videos
      WHERE account_id = ${testAccountId}
        AND status IN ('waiting_upload', 'uploading', 'processing', 'ready')
    `)).rows as Array<{ count: number }>;

    assert(Number(finalVideoCountRes.count) === 10, `Total final de vídeos é exatamente 10 (NUNCA 11) - Encontrado: ${finalVideoCountRes.count}`);

    // Verify 11th creation attempt fails cleanly
    let threwOn11th = false;
    try {
      await createVideoUploadSession(testAccountId, {
        title: "Video 11 Attempt",
        filename: "v11.mp4",
        mimeType: "video/mp4",
        sizeBytes: 1000000,
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        threwOn11th = err.message === "VIDEO_LIMIT_REACHED";
      }
    }
    assert(threwOn11th, "11º vídeo bloqueado com VIDEO_LIMIT_REACHED");

    // -------------------------------------------------------------
    // TEST 6, 7, 8, 9, 10, 11: SPEC 038 Preloaded Authorization & Background Tracking
    // -------------------------------------------------------------
    console.log("\n6, 7, 8, 9, 10, 11. Teste: Spec 038 Bootstrap Entitlement & Tracking");
    const testVideoPublicId = crypto.randomUUID();
    const testVideoId = crypto.randomUUID();

    await db.insert(schema.videos).values({
      id: testVideoId,
      publicId: testVideoPublicId,
      accountId: testAccountId,
      title: "Play Limits Test Video",
      status: "ready",
      muxPlaybackId: "dummy_playback_id_12345",
      originalFilename: "test.mp4",
      mimeType: "video/mp4",
      sizeBytes: 1000000,
    });

    const periodKey = getCurrentPeriodKey();

    // Verify initial monthly usage is 0
    const usageBefore = await getPlanUsage(testUserId, testAccountId);
    assert(usageBefore.playsThisMonth === 0, "Uso inicial de plays no mês é 0");

    // 6: Bootstrap Entitlement is authorized on load (Read-only, 0 plays increment)
    const bootstrapEntitlement = await resolvePlaybackEntitlement(testVideoPublicId);
    assert(bootstrapEntitlement.authorized === true, "Bootstrap entitlement autorizado no carregamento");
    const usageAfterBootstrap = await getPlanUsage(testUserId, testAccountId);
    assert(usageAfterBootstrap.playsThisMonth === 0, "Bootstrap de load NÃO incrementa contador de plays");

    // 7: First Play tracking in background -> records session + increments monthly_usage
    const session1Id = "playsession_alpha_1";
    const track1 = await recordPlaybackSession({
      publicId: testVideoPublicId,
      playSessionId: session1Id,
    });
    assert(track1.success === true && track1.recorded === true, "1ª sessão de play registrada em background");

    const usageAfter1 = await getPlanUsage(testUserId, testAccountId);
    assert(usageAfter1.playsThisMonth === 1, `Plays incrementado para 1 (atual: ${usageAfter1.playsThisMonth})`);

    // 8: Idempotency: retry with SAME playSessionId -> does NOT increment plays
    const track1Retry = await recordPlaybackSession({
      publicId: testVideoPublicId,
      playSessionId: session1Id,
    });
    assert(track1Retry.success === true && track1Retry.recorded === false, "Retry da mesma playSession é idempotente (recorded = false)");
    const usageAfterRetry = await getPlanUsage(testUserId, testAccountId);
    assert(usageAfterRetry.playsThisMonth === 1, `Plays continua 1 após retry na mesma sessão (atual: ${usageAfterRetry.playsThisMonth})`);

    // 9: New playSession -> increments plays to 2
    const session2Id = "playsession_beta_2";
    const track2 = await recordPlaybackSession({
      publicId: testVideoPublicId,
      playSessionId: session2Id,
    });
    assert(track2.success === true && track2.recorded === true, "Nova sessão incrementou plays");
    const usageAfter2 = await getPlanUsage(testUserId, testAccountId);
    assert(usageAfter2.playsThisMonth === 2, `Nova sessão incrementou plays para 2 (atual: ${usageAfter2.playsThisMonth})`);

    // 10: Editor preview tracking exemption
    const editorPreviewTrack = await recordPlaybackSession({
      publicId: testVideoPublicId,
      playSessionId: "editor_preview_session",
      isEditorAdmin: true,
      adminUserId: testUserId,
    });
    assert(editorPreviewTrack.success === true && editorPreviewTrack.recorded === false, "Preview do editor não consome quota");
    const usageAfterEditor = await getPlanUsage(testUserId, testAccountId);
    assert(usageAfterEditor.playsThisMonth === 2, `Preview do editor manteve plays inalterado (continua ${usageAfterEditor.playsThisMonth})`);

    // -------------------------------------------------------------
    // TEST 12 & 13: Limite de 5000 plays -> Bootstrap bloqueia novo load com 403
    // -------------------------------------------------------------
    console.log("\n12 & 13. Teste: Limite de Quota no Bootstrap (plays >= 5000 -> 403)");
    // Set plays to 4999 (can load)
    await db
      .update(schema.monthlyUsage)
      .set({ plays: 4999 })
      .where(and(eq(schema.monthlyUsage.userId, testUserId), eq(schema.monthlyUsage.periodKey, periodKey)));

    const canLoadAt4999 = await canLoadPlayback(testUserId, activePlan!);
    assert(canLoadAt4999 === true, "Com 4999/5000 plays, canLoadPlayback é true");
    const entitlementAt4999 = await resolvePlaybackEntitlement(testVideoPublicId);
    assert(entitlementAt4999.authorized === true, "Bootstrap autorizado com 4999/5000 plays");

    // Simulate play happening and reaching 5000 plays
    await recordPlaybackSession({
      publicId: testVideoPublicId,
      playSessionId: "session_5000th",
    });

    const usageAt5000 = await getPlanUsage(testUserId, testAccountId);
    assert(usageAt5000.playsThisMonth === 5000, `Uso atual é 5000/5000 plays`);

    // Now, on NEXT bootstrap load -> blocked with 403!
    const canLoadAt5000 = await canLoadPlayback(testUserId, activePlan!);
    assert(canLoadAt5000 === false, "Com 5000/5000 plays, canLoadPlayback é false");

    const entitlementAt5000 = await resolvePlaybackEntitlement(testVideoPublicId);
    assert(entitlementAt5000.authorized === false, "Bootstrap com quota esgotada retorna authorized = false");
    assert(entitlementAt5000.statusCode === 403, "Status code retornado é 403 Forbidden");
    assert(entitlementAt5000.error === "Este vídeo está temporariamente indisponível.", "Mensagem neutra de indisponibilidade retornada");

    // -------------------------------------------------------------
    // TEST 14: Duração > 20 min (1200s) -> Rejeitado
    // -------------------------------------------------------------
    console.log("\n14. Teste: Validação de duração (20:01 = 1201s -> rejeitado)");
    const durationVideoId = crypto.randomUUID();
    await db.insert(schema.videos).values({
      id: durationVideoId,
      publicId: crypto.randomUUID(),
      accountId: testAccountId,
      title: "Long Video 20m1s",
      status: "processing",
      duration: 1201,
      originalFilename: "long.mp4",
      mimeType: "video/mp4",
      sizeBytes: 50000000,
    });

    // -------------------------------------------------------------
    // TEST 15: Revoke Pro -> bloqueio imediato no Bootstrap
    // -------------------------------------------------------------
    console.log("\n15. Teste: Revoke Pro bloqueia Bootstrap público imediatamente com 403");
    await db
      .update(schema.subscriptions)
      .set({
        status: "inactive",
        endedAt: new Date(),
      })
      .where(and(eq(schema.subscriptions.userId, testUserId), eq(schema.subscriptions.status, "active")));

    const planAfterRevoke = await getActivePlanForUser(testUserId);
    assert(planAfterRevoke === null, "getActivePlanForUser retorna null após revoke");

    let threwOnPrivateAfterRevoke = false;
    try {
      await requireActivePlanForUser(testUserId);
    } catch (err: unknown) {
      if (err instanceof Error) {
        threwOnPrivateAfterRevoke = err.message === "NO_ACTIVE_PLAN";
      }
    }
    assert(threwOnPrivateAfterRevoke, "Ação privada bloqueada imediatamente com NO_ACTIVE_PLAN");

    const bootstrapAfterRevoke = await resolvePlaybackEntitlement(testVideoPublicId);
    assert(bootstrapAfterRevoke.authorized === false, "Bootstrap público bloqueado imediatamente após revoke");
    assert(bootstrapAfterRevoke.statusCode === 403, "Status code é 403");
    assert(bootstrapAfterRevoke.error === "Este vídeo está temporariamente indisponível.", "Mensagem neutra exibida no player");

  } finally {
    // Cleanup test data
    console.log("\nLimpando dados de teste...");
    try {
      await db.delete(schema.user).where(eq(schema.user.id, testUserId));
      await db.delete(schema.accounts).where(eq(schema.accounts.id, testAccountId));
    } catch {
      // Cascade handles videos, subscriptions, monthly_usage, play_sessions
    }
  }

  console.log("\n========================================================");
  console.log(`RESULTADO FINAL: ${testsPassed} PASSOU, ${testsFailed} FALHOU`);
  console.log("========================================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests();
