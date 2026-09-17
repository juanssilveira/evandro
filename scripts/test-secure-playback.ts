import * as dotenv from "dotenv";
import * as path from "node:path";
import * as crypto from "node:crypto";

const rootDir = process.cwd();
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config({ path: path.join(rootDir, ".env") });

// Ensure test signing key exists for test runs
if (!process.env.MUX_SIGNING_KEY_ID || !process.env.MUX_SIGNING_PRIVATE_KEY) {
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });
  process.env.MUX_SIGNING_KEY_ID = "test_signing_key_id";
  process.env.MUX_SIGNING_PRIVATE_KEY = privateKey;
}

if (!process.env.MUX_TOKEN_ID) process.env.MUX_TOKEN_ID = "dummy_token_id";
if (!process.env.MUX_TOKEN_SECRET) process.env.MUX_TOKEN_SECRET = "dummy_token_secret";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  resolvePlaybackEntitlement,
  validateAndActivatePlayback,
} from "@/lib/plans/playback";
import { getMuxSignedPlaybackUrl, getMuxSignedThumbnailUrl } from "@/lib/mux";

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
  console.log("=== STARTING SPEC 036 SECURE PLAYBACK & ORDER OF AUTHORIZATION TEST SUITE ===\n");

  const testEmail = `test_secure_${Date.now()}@evandro.watch`;
  const testUserId = `user_secure_${Date.now()}`;
  const testAccountId = crypto.randomUUID();

  try {
    // 0. Setup clean user, account and membership
    console.log("Setting up test environment...");
    await db.insert(schema.user).values({
      id: testUserId,
      name: "Test Secure User",
      email: testEmail,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(schema.accounts).values({
      id: testAccountId,
      name: "Test Secure Account",
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
    // TEST 1: Conta SEM plano + Vídeo NÃO ready
    // CRITICAL ORDER TEST: Must fail at Phase 1 entitlement BEFORE
    // inspecting video readiness / Mux / playback ID.
    // -------------------------------------------------------------
    console.log("\n1. Teste de Ordem: Conta SEM plano + Vídeo NÃO ready");
    const videoNotReadyPublicId = crypto.randomUUID();
    const videoNotReadyId = crypto.randomUUID();

    await db.insert(schema.videos).values({
      id: videoNotReadyId,
      publicId: videoNotReadyPublicId,
      accountId: testAccountId,
      title: "Processing Video No Plan",
      status: "processing", // NOT ready
      muxPlaybackId: null,  // NO playback ID
      originalFilename: "raw.mp4",
      mimeType: "video/mp4",
      sizeBytes: 1000000,
    });

    // Phase 1 Entitlement direct check
    const entitlementNoPlan = await resolvePlaybackEntitlement(videoNotReadyPublicId);
    assert(entitlementNoPlan.authorized === false, "resolvePlaybackEntitlement retornou authorized === false");
    assert(entitlementNoPlan.statusCode === 403, "resolvePlaybackEntitlement retornou statusCode 403 (Plano inexistente)");
    assert(entitlementNoPlan.error === "Este vídeo está temporariamente indisponível.", "Mensagem neutra de indisponibilidade");

    // Full Activation check
    const activationNoPlanNotReady = await validateAndActivatePlayback({
      publicId: videoNotReadyPublicId,
      playSessionId: "session_no_plan_not_ready",
    });
    assert(activationNoPlanNotReady.authorized === false, "validateAndActivatePlayback bloqueou");
    assert(activationNoPlanNotReady.statusCode === 403, "Status é 403 (entitlement falha ANTES de verificar status de mídia)");
    assert(activationNoPlanNotReady.playbackUrl === undefined, "Nenhum playbackUrl retornado");

    // -------------------------------------------------------------
    // TEST 2: Conta SEM plano + Vídeo READY
    // Must fail at Phase 1 entitlement with 403.
    // -------------------------------------------------------------
    console.log("\n2. Teste: Conta SEM plano + Vídeo READY");
    const videoReadyPublicId = crypto.randomUUID();
    const videoReadyId = crypto.randomUUID();

    await db.insert(schema.videos).values({
      id: videoReadyId,
      publicId: videoReadyPublicId,
      accountId: testAccountId,
      title: "Ready Video No Plan",
      status: "ready",
      muxPlaybackId: "mock_signed_pb_123",
      originalFilename: "ready.mp4",
      mimeType: "video/mp4",
      sizeBytes: 1000000,
    });

    const activationNoPlanReady = await validateAndActivatePlayback({
      publicId: videoReadyPublicId,
      playSessionId: "session_no_plan_ready",
    });
    assert(activationNoPlanReady.authorized === false, "Ativação bloqueada sem plano mesmo com vídeo ready");
    assert(activationNoPlanReady.statusCode === 403, "Status é 403");
    assert(activationNoPlanReady.playbackUrl === undefined, "Nenhum playbackUrl retornado");

    // -------------------------------------------------------------
    // TEST 3: Editor SEM plano
    // Editor MUST NOT bypass entitlement.
    // -------------------------------------------------------------
    console.log("\n3. Teste: Editor SEM plano");
    const activationEditorNoPlan = await validateAndActivatePlayback({
      publicId: videoReadyPublicId,
      playSessionId: "session_editor_no_plan",
      isEditorAdmin: true,
      adminUserId: testUserId,
    });
    assert(activationEditorNoPlan.authorized === false, "Editor sem plano é bloqueado no entitlement");
    assert(activationEditorNoPlan.statusCode === 403, "Status é 403");

    // -------------------------------------------------------------
    // TEST 4: Grant Pro -> Ativação de vídeo NÃO ready
    // Passes Phase 1 entitlement, fails on Phase 2 (status !== ready -> 404)
    // -------------------------------------------------------------
    console.log("\n4. Teste: Conta COM plano + Vídeo NÃO ready");
    await db.insert(schema.subscriptions).values({
      userId: testUserId,
      planCode: "pro",
      status: "active",
      startedAt: new Date(),
      expiresAt: null,
    });

    // Entitlement passes
    const entitlementWithPlan = await resolvePlaybackEntitlement(videoNotReadyPublicId);
    assert(entitlementWithPlan.authorized === true, "resolvePlaybackEntitlement autorizado com plano");
    assert(entitlementWithPlan.videoId === videoNotReadyId, "Identidade mínima resolvida corretamente");
    assert(entitlementWithPlan.ownerUserId === testUserId, "Owner resolvido");

    // Activation fails at Phase 2 because video is not ready
    const activationWithPlanNotReady = await validateAndActivatePlayback({
      publicId: videoNotReadyPublicId,
      playSessionId: "session_plan_not_ready",
    });
    assert(activationWithPlanNotReady.authorized === false, "Ativação de vídeo não ready falhou");
    assert(activationWithPlanNotReady.statusCode === 404, "Status é 404 (Vídeo em processamento ou indisponível)");

    // -------------------------------------------------------------
    // TEST 5: Conta COM plano + Vídeo READY -> Sucesso com Signed Playback URL
    // -------------------------------------------------------------
    console.log("\n5. Teste: Conta COM plano + Vídeo READY -> Sucesso");
    const activationSuccess = await validateAndActivatePlayback({
      publicId: videoReadyPublicId,
      playSessionId: "session_success_1",
    });
    assert(activationSuccess.authorized === true, "Ativação autorizada com sucesso");
    assert(activationSuccess.statusCode === 200, "Status 200");
    assert(Boolean(activationSuccess.playbackUrl?.includes("stream.mux.com/mock_signed_pb_123.m3u8?token=")), "URL assinada HLS com token JWT gerada corretamente");

    // -------------------------------------------------------------
    // TEST 6: Editor COM plano -> Autorizado e Isento de Quota
    // -------------------------------------------------------------
    console.log("\n6. Teste: Editor COM plano -> Isento de Quota");
    const editorActivation = await validateAndActivatePlayback({
      publicId: videoReadyPublicId,
      playSessionId: "session_editor_preview",
      isEditorAdmin: true,
      adminUserId: testUserId,
    });
    assert(editorActivation.authorized === true, "Editor autenticado autorizado");
    assert(Boolean(editorActivation.playbackUrl?.includes("mock_signed_pb_123")), "URL assinada gerada para editor");

    // -------------------------------------------------------------
    // TEST 7: Assinatura EXPIRADA -> 403 no entitlement
    // -------------------------------------------------------------
    console.log("\n7. Teste: Assinatura EXPIRADA");
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db
      .update(schema.subscriptions)
      .set({
        expiresAt: yesterday,
      })
      .where(eq(schema.subscriptions.userId, testUserId));

    const entitlementExpired = await resolvePlaybackEntitlement(videoReadyPublicId);
    assert(entitlementExpired.authorized === false, "Entitlement falha com plano expirado");
    assert(entitlementExpired.statusCode === 403, "Status 403 para plano expirado");

    const activationExpired = await validateAndActivatePlayback({
      publicId: videoReadyPublicId,
      playSessionId: "session_expired_plan",
    });
    assert(activationExpired.authorized === false, "Ativação bloqueada com plano expirado");
    assert(activationExpired.statusCode === 403, "Status 403 na ativação com plano expirado");

    // -------------------------------------------------------------
    // TEST 8: Signed URLs helpers (Mux)
    // -------------------------------------------------------------
    console.log("\n8. Teste: Helpers Mux de Signed Playback e Thumbnail");
    const signedPb = await getMuxSignedPlaybackUrl("test_playback_id", 1800);
    assert(signedPb.startsWith("https://stream.mux.com/test_playback_id.m3u8?token="), "getMuxSignedPlaybackUrl retorna stream.mux.com com token");

    const signedThumb = await getMuxSignedThumbnailUrl("test_playback_id", { width: 640 });
    assert(signedThumb.startsWith("https://image.mux.com/test_playback_id/thumbnail.webp?"), "getMuxSignedThumbnailUrl retorna image.mux.com com query params e token");
    assert(signedThumb.includes("width=640"), "getMuxSignedThumbnailUrl inclui width=640");
    assert(signedThumb.includes("token="), "getMuxSignedThumbnailUrl inclui token=");

  } finally {
    console.log("\nLimpando dados de teste...");
    try {
      await db.delete(schema.user).where(eq(schema.user.id, testUserId));
      await db.delete(schema.accounts).where(eq(schema.accounts.id, testAccountId));
    } catch {
      // Cascade handles videos, subscriptions, account_members, monthly_usage, play_sessions
    }
  }

  console.log("\n========================================================");
  console.log(`RESULTADO DOS TESTES: ${testsPassed} PASSOU, ${testsFailed} FALHOU`);
  console.log("========================================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests();
