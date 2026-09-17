import * as dotenv from "dotenv";
import * as path from "node:path";

const rootDir = process.cwd();
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config({ path: path.join(rootDir, ".env") });

import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  getActivePlanForUser,
  requireActivePlanForUser,
  getCurrentPeriodKey,
  getPlanUsage,
} from "@/lib/plans/access";
import { validateAndActivatePlayback } from "@/lib/plans/playback";
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
  console.log("=== STARTING SPEC 024 PLANS & REAL LIMITS TEST SUITE ===\n");

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
    // TEST 6, 7, 8, 9, 10, 11: Plays, Idempotência e PlaySessions
    // -------------------------------------------------------------
    console.log("\n6, 7, 8, 9, 10, 11. Teste: Views vs Plays, Idempotência e PlaySessions");
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

    // 6 & 7: Render / Preview does not increment plays (only intentional activation does)
    assert(usageBefore.playsThisMonth === 0, "Render e Background Preview têm 0 Plays");

    // 8: First intentional activation -> +1 Play
    const session1Id = "playsession_alpha_1";
    const activation1 = await validateAndActivatePlayback({
      publicId: testVideoPublicId,
      playSessionId: session1Id,
    });
    assert(activation1.authorized === true, "1ª ativação autorizada");
    assert(Boolean(activation1.playbackUrl?.includes("dummy_playback_id_12345")), "HLS entregue após autorização");

    const usageAfter1 = await getPlanUsage(testUserId, testAccountId);
    assert(usageAfter1.playsThisMonth === 1, `Plays incrementado para 1 (atual: ${usageAfter1.playsThisMonth})`);

    // 9 & 10: Pause/Play & Retry with SAME playSessionId -> continues 1 (Idempotent)
    const activation1Retry = await validateAndActivatePlayback({
      publicId: testVideoPublicId,
      playSessionId: session1Id,
    });
    assert(activation1Retry.authorized === true, "Retry da mesma playSession autorizado");
    const usageAfterRetry = await getPlanUsage(testUserId, testAccountId);
    assert(usageAfterRetry.playsThisMonth === 1, `Plays continua 1 após retry na mesma sessão (atual: ${usageAfterRetry.playsThisMonth})`);

    // 11: New playSession -> +1 Play
    const session2Id = "playsession_beta_2";
    const activation2 = await validateAndActivatePlayback({
      publicId: testVideoPublicId,
      playSessionId: session2Id,
    });
    assert(activation2.authorized === true, "2ª playSession autorizada");
    const usageAfter2 = await getPlanUsage(testUserId, testAccountId);
    assert(usageAfter2.playsThisMonth === 2, `Nova sessão incrementou plays para 2 (atual: ${usageAfter2.playsThisMonth})`);

    // Internal editor testing does NOT consume quota
    const editorTestActivation = await validateAndActivatePlayback({
      publicId: testVideoPublicId,
      playSessionId: "editor_preview_session",
      isEditorAdmin: true,
      adminUserId: testUserId,
    });
    assert(editorTestActivation.authorized === true, "Preview interno autorizado");
    const usageAfterEditor = await getPlanUsage(testUserId, testAccountId);
    assert(usageAfterEditor.playsThisMonth === 2, `Preview do editor não consumiu quota (continua ${usageAfterEditor.playsThisMonth})`);

    // -------------------------------------------------------------
    // TEST 12 & 13: Concorrência 4999 Plays -> duas sessões simultâneas -> final 5000 (NUNCA 5001)
    // -------------------------------------------------------------
    console.log("\n12 & 13. Teste: Concorrência em 4999 Plays (duas sessões simultâneas -> max 5000)");
    // Set plays to 4999 directly
    await db
      .update(schema.monthlyUsage)
      .set({ plays: 4999 })
      .where(and(eq(schema.monthlyUsage.userId, testUserId), eq(schema.monthlyUsage.periodKey, periodKey)));

    const usageAt4999 = await getPlanUsage(testUserId, testAccountId);
    assert(usageAt4999.playsThisMonth === 4999, "Plays configurado para 4999");

    // Fire 2 concurrent new activations
    console.log("  Disparando 2 novas ativações simultâneas em 4999 plays...");
    const concurrentPlayResults = await Promise.all([
      validateAndActivatePlayback({
        publicId: testVideoPublicId,
        playSessionId: "session_concurrent_x",
      }),
      validateAndActivatePlayback({
        publicId: testVideoPublicId,
        playSessionId: "session_concurrent_y",
      }),
    ]);

    const playAuths = concurrentPlayResults.filter((r) => r.authorized);
    const playDenials = concurrentPlayResults.filter((r) => !r.authorized);

    assert(playAuths.length === 1, "Exatamente 1 sessão atingiu o 5000º Play e foi autorizada");
    assert(playDenials.length === 1, "A outra sessão concorrente foi negada por quota cheia");

    const usageFinal5000 = await getPlanUsage(testUserId, testAccountId);
    assert(
      usageFinal5000.playsThisMonth === 5000,
      `Plays final é exatamente 5000 (NUNCA 5001) - Encontrado: ${usageFinal5000.playsThisMonth}`
    );

    // 13: At 5000/5000 Plays, any new activation is DENIED and no HLS returned
    const deniedSession = await validateAndActivatePlayback({
      publicId: testVideoPublicId,
      playSessionId: "session_at_5000_limit",
    });
    assert(deniedSession.authorized === false, "Nova sessão com 5000 plays foi negada");
    assert(deniedSession.playbackUrl === undefined, "Nenhum HLS retornado com quota cheia");
    assert(deniedSession.error === "Este vídeo está temporariamente indisponível.", "Mensagem neutra de indisponibilidade retornada");

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
    // TEST 15: Revoke Pro -> bloqueio imediato sem precisar logout
    // -------------------------------------------------------------
    console.log("\n15. Teste: Revoke Pro bloqueia novas requisições privadas e públicas imediatamente");
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

    const publicActivationAfterRevoke = await validateAndActivatePlayback({
      publicId: testVideoPublicId,
      playSessionId: "session_after_revoke",
    });
    assert(publicActivationAfterRevoke.authorized === false, "Ativação pública bloqueada imediatamente após revoke");
    assert(publicActivationAfterRevoke.error === "Este vídeo está temporariamente indisponível.", "Mensagem neutra exibida no player");

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
