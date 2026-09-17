import * as dotenv from "dotenv";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { neon, neonConfig } from "@neondatabase/serverless";
import Mux from "@mux/mux-node";

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

const sql = neon(connectionString);

// Test signing key setup
const { privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
});
const testKeyId = "test_signing_key_id";

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID || "dummy_token_id",
  tokenSecret: process.env.MUX_TOKEN_SECRET || "dummy_token_secret",
  jwtSigningKey: testKeyId,
  jwtPrivateKey: privateKey,
});

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

function getCurrentPeriodKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
}

// -------------------------------------------------------------
// Emulated resolvePlaybackEntitlement according to spec
// -------------------------------------------------------------
async function testResolvePlaybackEntitlement(publicId) {
  if (!publicId || typeof publicId !== "string" || !publicId.trim()) {
    return {
      authorized: false,
      error: "Identificador de vídeo inválido.",
      statusCode: 400,
    };
  }

  // 1. Minimum query by publicId ONLY (id and accountId)
  const minVideoRows = await sql`
    SELECT id, account_id
    FROM videos
    WHERE public_id = ${publicId.trim()}
    LIMIT 1
  `;

  if (minVideoRows.length === 0) {
    return {
      authorized: false,
      error: "Vídeo não encontrado.",
      statusCode: 404,
    };
  }

  const minVideo = minVideoRows[0];

  // 2. Resolve account owner userId
  const ownerRows = await sql`
    SELECT user_id
    FROM account_members
    WHERE account_id = ${minVideo.account_id}
      AND role = 'owner'
    LIMIT 1
  `;

  if (ownerRows.length === 0) {
    return {
      authorized: false,
      error: "Proprietário do vídeo não encontrado.",
      statusCode: 404,
    };
  }

  const ownerUserId = ownerRows[0].user_id;

  // 3. Verify owner has active plan
  const subRows = await sql`
    SELECT id, user_id, plan_code, status, expires_at
    FROM subscriptions
    WHERE user_id = ${ownerUserId}
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (subRows.length === 0) {
    return {
      authorized: false,
      error: "Este vídeo está temporariamente indisponível.",
      statusCode: 403,
    };
  }

  return {
    authorized: true,
    videoId: minVideo.id,
    accountId: minVideo.account_id,
    ownerUserId,
    activePlan: subRows[0],
  };
}

// -------------------------------------------------------------
// Emulated validateAndActivatePlayback according to spec
// -------------------------------------------------------------
async function testValidateAndActivatePlayback({ publicId, playSessionId, isEditorAdmin, adminUserId }) {
  if (!playSessionId || typeof playSessionId !== "string" || !playSessionId.trim()) {
    return {
      authorized: false,
      error: "Identificador de sessão de reprodução inválido.",
      statusCode: 400,
    };
  }

  // FASE 1: Entitlement
  const entitlement = await testResolvePlaybackEntitlement(publicId);
  if (!entitlement.authorized) {
    return {
      authorized: false,
      error: entitlement.error || "Este vídeo está temporariamente indisponível.",
      statusCode: entitlement.statusCode || 403,
    };
  }

  const { videoId, accountId, ownerUserId } = entitlement;

  // FASE 2: Playback & Media Release
  let isVerifiedEditor = false;
  if (isEditorAdmin && adminUserId && accountId) {
    const memRows = await sql`
      SELECT id FROM account_members
      WHERE account_id = ${accountId} AND user_id = ${adminUserId}
      LIMIT 1
    `;
    if (memRows.length > 0) {
      isVerifiedEditor = true;
    }
  }

  const videoRows = await sql`
    SELECT id, status, mux_playback_id
    FROM videos
    WHERE id = ${videoId}
    LIMIT 1
  `;

  if (videoRows.length === 0 || videoRows[0].status !== "ready" || !videoRows[0].mux_playback_id) {
    return {
      authorized: false,
      error: "Vídeo em processamento ou indisponível.",
      statusCode: 404,
    };
  }

  const video = videoRows[0];

  if (isVerifiedEditor) {
    const token = await mux.jwt.signPlaybackId(video.mux_playback_id, {
      type: "video",
      expiration: "3600s",
    });
    return {
      authorized: true,
      playbackUrl: `https://stream.mux.com/${video.mux_playback_id}.m3u8?token=${token}`,
      statusCode: 200,
    };
  }

  // Regular viewer quota
  const periodKey = getCurrentPeriodKey();
  const maxPlays = 5000;

  // Register play session idempotently
  const sessionInsert = await sql`
    INSERT INTO play_sessions (id, video_id, owner_user_id, play_session_id, created_at)
    VALUES (gen_random_uuid(), ${video.id}, ${ownerUserId}, ${playSessionId.trim()}, NOW())
    ON CONFLICT (video_id, play_session_id) DO NOTHING
    RETURNING id
  `;

  const isNewSession = sessionInsert.length > 0;
  if (isNewSession) {
    await sql`
      INSERT INTO monthly_usage (id, user_id, period_key, plays, created_at, updated_at)
      VALUES (gen_random_uuid(), ${ownerUserId}, ${periodKey}, 0, NOW(), NOW())
      ON CONFLICT (user_id, period_key) DO NOTHING
    `;

    const updateRes = await sql`
      UPDATE monthly_usage
      SET plays = plays + 1, updated_at = NOW()
      WHERE user_id = ${ownerUserId}
        AND period_key = ${periodKey}
        AND plays < ${maxPlays}
      RETURNING plays
    `;

    if (updateRes.length === 0) {
      return {
        authorized: false,
        error: "Este vídeo está temporariamente indisponível.",
        statusCode: 403,
      };
    }
  }

  const token = await mux.jwt.signPlaybackId(video.mux_playback_id, {
    type: "video",
    expiration: "3600s",
  });

  return {
    authorized: true,
    playbackUrl: `https://stream.mux.com/${video.mux_playback_id}.m3u8?token=${token}`,
    statusCode: 200,
  };
}

async function runTests() {
  console.log("=== STARTING SPEC 036 SECURE PLAYBACK INTEGRATION SUITE ===\n");

  const testEmail = `test_sec_${Date.now()}@evandro.watch`;
  const testUserId = `user_sec_${Date.now()}`;
  const testAccountId = crypto.randomUUID();

  try {
    console.log("Setting up test environment...");
    await sql`
      INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
      VALUES (${testUserId}, 'Test Secure', ${testEmail}, true, NOW(), NOW())
    `;

    await sql`
      INSERT INTO accounts (id, name, created_at, updated_at)
      VALUES (${testAccountId}, 'Secure Account', NOW(), NOW())
    `;

    await sql`
      INSERT INTO account_members (id, account_id, user_id, role, created_at)
      VALUES (gen_random_uuid(), ${testAccountId}, ${testUserId}, 'owner', NOW())
    `;

    // -------------------------------------------------------------
    // TEST 1: Conta SEM plano + Vídeo NÃO ready
    // Ordem arquitetural: DEVE falhar no entitlement antes de verificar status
    // -------------------------------------------------------------
    console.log("\n1. Teste de Ordem: Conta SEM plano + Vídeo NÃO ready");
    const videoNotReadyPublicId = crypto.randomUUID();
    const videoNotReadyId = crypto.randomUUID();

    await sql`
      INSERT INTO videos (id, public_id, account_id, title, status, mux_playback_id, original_filename, mime_type, size_bytes, created_at, updated_at)
      VALUES (${videoNotReadyId}, ${videoNotReadyPublicId}, ${testAccountId}, 'Not Ready Video', 'processing', NULL, 'test.mp4', 'video/mp4', 1000, NOW(), NOW())
    `;

    const entitlement1 = await testResolvePlaybackEntitlement(videoNotReadyPublicId);
    assert(entitlement1.authorized === false, "Entitlement sem plano retorna false");
    assert(entitlement1.statusCode === 403, "Entitlement sem plano retorna 403");

    const activation1 = await testValidateAndActivatePlayback({
      publicId: videoNotReadyPublicId,
      playSessionId: "session_1",
    });
    assert(activation1.authorized === false, "Ativação bloqueada sem plano (vídeo não ready)");
    assert(activation1.statusCode === 403, "Status 403 (falhou no entitlement antes de checar status 404)");
    assert(activation1.playbackUrl === undefined, "Nenhum playbackUrl retornado");

    // -------------------------------------------------------------
    // TEST 2: Conta SEM plano + Vídeo READY
    // -------------------------------------------------------------
    console.log("\n2. Teste: Conta SEM plano + Vídeo READY");
    const videoReadyPublicId = crypto.randomUUID();
    const videoReadyId = crypto.randomUUID();

    await sql`
      INSERT INTO videos (id, public_id, account_id, title, status, mux_playback_id, original_filename, mime_type, size_bytes, created_at, updated_at)
      VALUES (${videoReadyId}, ${videoReadyPublicId}, ${testAccountId}, 'Ready Video', 'ready', 'signed_pb_123', 'ready.mp4', 'video/mp4', 1000, NOW(), NOW())
    `;

    const activation2 = await testValidateAndActivatePlayback({
      publicId: videoReadyPublicId,
      playSessionId: "session_2",
    });
    assert(activation2.authorized === false, "Ativação bloqueada sem plano com vídeo ready");
    assert(activation2.statusCode === 403, "Status 403");

    // -------------------------------------------------------------
    // TEST 3: Editor SEM plano -> Bloqueado
    // -------------------------------------------------------------
    console.log("\n3. Teste: Editor SEM plano");
    const activation3 = await testValidateAndActivatePlayback({
      publicId: videoReadyPublicId,
      playSessionId: "session_editor_no_plan",
      isEditorAdmin: true,
      adminUserId: testUserId,
    });
    assert(activation3.authorized === false, "Editor sem plano é bloqueado no entitlement");
    assert(activation3.statusCode === 403, "Status 403");

    // -------------------------------------------------------------
    // TEST 4: Grant Pro -> Vídeo NÃO ready -> passa Fase 1, falha na Fase 2 (404)
    // -------------------------------------------------------------
    console.log("\n4. Teste: Conta COM plano + Vídeo NÃO ready");
    await sql`
      INSERT INTO subscriptions (id, user_id, plan_code, status, started_at, expires_at, created_at, updated_at)
      VALUES (gen_random_uuid(), ${testUserId}, 'pro', 'active', NOW(), NULL, NOW(), NOW())
    `;

    const entitlement4 = await testResolvePlaybackEntitlement(videoNotReadyPublicId);
    assert(entitlement4.authorized === true, "Entitlement com plano retorna true");
    assert(entitlement4.videoId === videoNotReadyId, "Identidade mínima resolvida");

    const activation4 = await testValidateAndActivatePlayback({
      publicId: videoNotReadyPublicId,
      playSessionId: "session_4",
    });
    assert(activation4.authorized === false, "Ativação de vídeo não ready falhou");
    assert(activation4.statusCode === 404, "Status 404 (Fase 2 detectou vídeo indisponível)");

    // -------------------------------------------------------------
    // TEST 5: Conta COM plano + Vídeo READY -> Sucesso com URL assinada
    // -------------------------------------------------------------
    console.log("\n5. Teste: Conta COM plano + Vídeo READY");
    const activation5 = await testValidateAndActivatePlayback({
      publicId: videoReadyPublicId,
      playSessionId: "session_success_5",
    });
    assert(activation5.authorized === true, "Ativação autorizada");
    assert(activation5.statusCode === 200, "Status 200");
    assert(Boolean(activation5.playbackUrl?.includes("stream.mux.com/signed_pb_123.m3u8?token=")), "URL assinada HLS gerada");

    // -------------------------------------------------------------
    // TEST 6: Editor COM plano -> Isento de quota
    // -------------------------------------------------------------
    console.log("\n6. Teste: Editor COM plano -> Isento de Quota");
    const activation6 = await testValidateAndActivatePlayback({
      publicId: videoReadyPublicId,
      playSessionId: "session_editor_preview",
      isEditorAdmin: true,
      adminUserId: testUserId,
    });
    assert(activation6.authorized === true, "Editor autenticado autorizado");
    assert(Boolean(activation6.playbackUrl?.includes("signed_pb_123")), "URL assinada entregue ao editor");

    // -------------------------------------------------------------
    // TEST 7: Assinatura EXPIRADA -> 403 no entitlement
    // -------------------------------------------------------------
    console.log("\n7. Teste: Assinatura EXPIRADA");
    await sql`
      UPDATE subscriptions
      SET expires_at = NOW() - INTERVAL '1 day'
      WHERE user_id = ${testUserId}
    `;

    const entitlement7 = await testResolvePlaybackEntitlement(videoReadyPublicId);
    assert(entitlement7.authorized === false, "Entitlement falha com plano expirado");
    assert(entitlement7.statusCode === 403, "Status 403 para plano expirado");

    const activation7 = await testValidateAndActivatePlayback({
      publicId: videoReadyPublicId,
      playSessionId: "session_7",
    });
    assert(activation7.authorized === false, "Ativação bloqueada com plano expirado");
    assert(activation7.statusCode === 403, "Status 403 na ativação");

    // -------------------------------------------------------------
    // TEST 8: Signed Playback e Thumbnail JWT
    // -------------------------------------------------------------
    console.log("\n8. Teste: Mux JWT Tokens");
    const pbToken = await mux.jwt.signPlaybackId("signed_pb_123", { type: "video", expiration: "3600s" });
    assert(Boolean(pbToken && pbToken.length > 50), "Token JWT de playback gerado");

    const thumbToken = await mux.jwt.signPlaybackId("signed_pb_123", { type: "thumbnail", expiration: "3600s", params: { width: "640" } });
    assert(Boolean(thumbToken && thumbToken.length > 50), "Token JWT de thumbnail gerado");

  } finally {
    console.log("\nLimpando dados de teste...");
    try {
      await sql`DELETE FROM "user" WHERE id = ${testUserId}`;
      await sql`DELETE FROM accounts WHERE id = ${testAccountId}`;
    } catch {
      // Cascades
    }
  }

  console.log("\n========================================================");
  console.log(`RESULTADO FINAL: ${testsPassed} PASSOU, ${testsFailed} FALHOU`);
  console.log("========================================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
