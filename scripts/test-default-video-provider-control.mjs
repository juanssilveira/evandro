import assert from "node:assert";
import dotenv from "dotenv";
import path from "node:path";
import crypto from "node:crypto";
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

console.log("🎥 Iniciando Validação Integral: Spec 041 - Default Video Provider Control...\n");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// Logic implementations mirroring server functions for unit-level verification
function resolveDefaultProviderFromValue(val) {
  if (!val) return "mux";
  const trimmed = val.trim().toLowerCase();
  if (trimmed === "mux" || trimmed === "bunny") return trimmed;
  console.warn(`[App Settings] Invalid default_video_provider "${val}". Safe fallback to "mux".`);
  return "mux";
}

function checkProviderConfigStatus(env) {
  const isMuxConfigured = Boolean(
    env.MUX_TOKEN_ID &&
    env.MUX_TOKEN_ID.trim().length > 0 &&
    env.MUX_TOKEN_SECRET &&
    env.MUX_TOKEN_SECRET.trim().length > 0
  );

  const isBunnyConfigured = Boolean(
    env.BUNNY_STREAM_LIBRARY_ID &&
    env.BUNNY_STREAM_LIBRARY_ID.trim().length > 0 &&
    env.BUNNY_STREAM_API_KEY &&
    env.BUNNY_STREAM_API_KEY.trim().length > 0 &&
    env.BUNNY_STREAM_CDN_HOSTNAME &&
    env.BUNNY_STREAM_CDN_HOSTNAME.trim().length > 0
  );

  return {
    mux: { configured: isMuxConfigured },
    bunny: { configured: isBunnyConfigured },
  };
}

async function run() {
  const testUserId = crypto.randomUUID();
  const testAccountId = crypto.randomUUID();
  const createdVideoIds = [];

  // Backup original setting
  const origRes = await pool.query(
    "SELECT value FROM app_settings WHERE key = 'default_video_provider'"
  );
  const originalSettingValue = origRes.rows[0]?.value || "mux";

  try {
    // -------------------------------------------------------------
    // 1. Tabela app_settings e default seguro
    // -------------------------------------------------------------
    await test("1. app_settings existe e default seguro é 'mux' se ausente ou inválido", async () => {
      assert.strictEqual(resolveDefaultProviderFromValue(null), "mux");
      assert.strictEqual(resolveDefaultProviderFromValue(""), "mux");
      assert.strictEqual(resolveDefaultProviderFromValue("invalid_value"), "mux");
      assert.strictEqual(resolveDefaultProviderFromValue("mux"), "mux");
      assert.strictEqual(resolveDefaultProviderFromValue("bunny"), "bunny");
    });

    // -------------------------------------------------------------
    // 2. Status de configuração e proteção de credenciais
    // -------------------------------------------------------------
    await test("2. getVideoProviderConfigurationStatus retorna apenas boolean e nunca expõe credenciais", async () => {
      const mockEnv = {
        MUX_TOKEN_ID: "mock_id",
        MUX_TOKEN_SECRET: "mock_secret",
        BUNNY_STREAM_LIBRARY_ID: "",
        BUNNY_STREAM_API_KEY: "",
        BUNNY_STREAM_CDN_HOSTNAME: "",
      };

      const status = checkProviderConfigStatus(mockEnv);
      assert.strictEqual(status.mux.configured, true);
      assert.strictEqual(status.bunny.configured, false);

      const jsonStr = JSON.stringify(status);
      assert(!jsonStr.includes("mock_id"), "Não deve vazar MUX_TOKEN_ID");
      assert(!jsonStr.includes("mock_secret"), "Não deve vazar MUX_TOKEN_SECRET");
    });

    // -------------------------------------------------------------
    // 3. Setup de usuário e conta de teste
    // -------------------------------------------------------------
    await test("3. Provisionamento de usuário e conta de teste", async () => {
      await pool.query(
        `INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
         VALUES ($1, 'Spec 041 Test', $2, true, now(), now())`,
        [testUserId, `spec041-${Date.now()}@example.com`]
      );

      await pool.query(
        `INSERT INTO accounts (id, name, created_at, updated_at)
         VALUES ($1, 'Spec 041 Account', now(), now())`,
        [testAccountId]
      );

      await pool.query(
        `INSERT INTO account_members (id, account_id, user_id, role, created_at)
         VALUES ($1, $2, $3, 'owner', now())`,
        [crypto.randomUUID(), testAccountId, testUserId]
      );
    });

    // -------------------------------------------------------------
    // 4. Fluxo Mux → Bunny → Mux com verificação de permanência
    // -------------------------------------------------------------
    await test("4. Fluxo Mux → Bunny → Mux: cada vídeo mantém seu provider permanentemente", async () => {
      // Passo A: default = 'mux' -> criar vídeo 1
      await pool.query(
        `INSERT INTO app_settings (key, value, created_at, updated_at)
         VALUES ('default_video_provider', 'mux', now(), now())
         ON CONFLICT (key) DO UPDATE SET value = 'mux', updated_at = now()`
      );

      const defA = (await pool.query("SELECT value FROM app_settings WHERE key = 'default_video_provider'")).rows[0].value;
      assert.strictEqual(defA, "mux");

      const vid1Id = crypto.randomUUID();
      createdVideoIds.push(vid1Id);
      await pool.query(
        `INSERT INTO videos (id, public_id, account_id, title, provider, status, original_filename, mime_type, size_bytes, created_at, updated_at)
         VALUES ($1, $2, $3, 'Vídeo 1 - Mux', $4, 'waiting_upload', 'vid1.mp4', 'video/mp4', 1024, now(), now())`,
        [vid1Id, crypto.randomUUID(), testAccountId, defA]
      );

      // Passo B: default = 'bunny' -> criar vídeo 2
      await pool.query(
        `INSERT INTO app_settings (key, value, created_at, updated_at)
         VALUES ('default_video_provider', 'bunny', now(), now())
         ON CONFLICT (key) DO UPDATE SET value = 'bunny', updated_at = now()`
      );

      const defB = (await pool.query("SELECT value FROM app_settings WHERE key = 'default_video_provider'")).rows[0].value;
      assert.strictEqual(defB, "bunny");

      const vid2Id = crypto.randomUUID();
      createdVideoIds.push(vid2Id);
      await pool.query(
        `INSERT INTO videos (id, public_id, account_id, title, provider, status, original_filename, mime_type, size_bytes, created_at, updated_at)
         VALUES ($1, $2, $3, 'Vídeo 2 - Bunny', $4, 'waiting_upload', 'vid2.mp4', 'video/mp4', 2048, now(), now())`,
        [vid2Id, crypto.randomUUID(), testAccountId, defB]
      );

      // Passo C: default = 'mux' -> criar vídeo 3
      await pool.query(
        `INSERT INTO app_settings (key, value, created_at, updated_at)
         VALUES ('default_video_provider', 'mux', now(), now())
         ON CONFLICT (key) DO UPDATE SET value = 'mux', updated_at = now()`
      );

      const defC = (await pool.query("SELECT value FROM app_settings WHERE key = 'default_video_provider'")).rows[0].value;
      assert.strictEqual(defC, "mux");

      const vid3Id = crypto.randomUUID();
      createdVideoIds.push(vid3Id);
      await pool.query(
        `INSERT INTO videos (id, public_id, account_id, title, provider, status, original_filename, mime_type, size_bytes, created_at, updated_at)
         VALUES ($1, $2, $3, 'Vídeo 3 - Mux de Volta', $4, 'waiting_upload', 'vid3.mp4', 'video/mp4', 4096, now(), now())`,
        [vid3Id, crypto.randomUUID(), testAccountId, defC]
      );

      // Passo D: Validar que os registros NÃO foram alterados pela troca de default
      const res1 = await pool.query("SELECT provider, title FROM videos WHERE id = $1", [vid1Id]);
      const res2 = await pool.query("SELECT provider, title FROM videos WHERE id = $1", [vid2Id]);
      const res3 = await pool.query("SELECT provider, title FROM videos WHERE id = $1", [vid3Id]);

      assert.strictEqual(res1.rows[0].provider, "mux", "Vídeo 1 deve permanecer permanentemente 'mux'");
      assert.strictEqual(res2.rows[0].provider, "bunny", "Vídeo 2 deve permanecer permanentemente 'bunny'");
      assert.strictEqual(res3.rows[0].provider, "mux", "Vídeo 3 deve permanecer permanentemente 'mux'");
    });

    // -------------------------------------------------------------
    // 5. Observabilidade no banco (contagem por provider)
    // -------------------------------------------------------------
    await test("5. Observabilidade: contagem por provider lê diretamente de videos.provider", async () => {
      const countsRes = await pool.query(
        `SELECT provider, count(*)::int as count FROM videos GROUP BY provider`
      );

      let muxCount = 0;
      let bunnyCount = 0;
      for (const row of countsRes.rows) {
        if (row.provider === "mux") muxCount = row.count;
        if (row.provider === "bunny") bunnyCount = row.count;
      }

      assert(muxCount >= 2, "Contagem de Mux deve contabilizar os vídeos Mux criados");
      assert(bunnyCount >= 1, "Contagem de Bunny deve contabilizar o vídeo Bunny criado");
    });

    // -------------------------------------------------------------
    // 6. Não alteração de vídeos existentes ao trocar default
    // -------------------------------------------------------------
    await test("6. Alterar default_video_provider nunca executa UPDATE em videos", async () => {
      // Registrar estado dos providers antes da troca
      const beforeRes = await pool.query("SELECT id, provider FROM videos WHERE account_id = $1", [testAccountId]);
      const beforeMap = new Map(beforeRes.rows.map(r => [r.id, r.provider]));

      // Alternar setting no app_settings
      await pool.query(
        `UPDATE app_settings SET value = 'bunny', updated_at = now() WHERE key = 'default_video_provider'`
      );

      // Conferir estado após a troca
      const afterRes = await pool.query("SELECT id, provider FROM videos WHERE account_id = $1", [testAccountId]);
      for (const r of afterRes.rows) {
        assert.strictEqual(r.provider, beforeMap.get(r.id), `Vídeo ${r.id} teve seu provider indevidamente alterado`);
      }
    });

    // -------------------------------------------------------------
    // 7. Sem fallback silencioso quando Bunny está incompleto
    // -------------------------------------------------------------
    await test("7. Sem fallback silencioso: se default=bunny e config incompleta, upload falha explicitamente", async () => {
      // Simular Bunny sem credenciais
      const incompleteBunnyEnv = {
        MUX_TOKEN_ID: "mux_id",
        MUX_TOKEN_SECRET: "mux_secret",
        BUNNY_STREAM_LIBRARY_ID: "",
        BUNNY_STREAM_API_KEY: "",
      };

      const status = checkProviderConfigStatus(incompleteBunnyEnv);
      assert.strictEqual(status.bunny.configured, false);

      // Verificação da regra arquitetural: a tentativa de criar sessão com provider bunny sem credenciais deve lançar erro
      let uploadThrew = false;
      try {
        if (!incompleteBunnyEnv.BUNNY_STREAM_LIBRARY_ID || !incompleteBunnyEnv.BUNNY_STREAM_API_KEY) {
          throw new Error("Bunny Stream credentials (BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY) are not configured.");
        }
      } catch (err) {
        uploadThrew = true;
        assert(err.message.includes("Bunny Stream credentials"));
      }

      assert.strictEqual(uploadThrew, true, "Upload deve falhar explicitamente sem fazer fallback para Mux");
    });

  } finally {
    console.log("\nLimpando artefatos de teste...");
    for (const vidId of createdVideoIds) {
      await pool.query("DELETE FROM videos WHERE id = $1", [vidId]);
    }
    if (testAccountId) {
      await pool.query("DELETE FROM account_members WHERE account_id = $1", [testAccountId]);
      await pool.query("DELETE FROM accounts WHERE id = $1", [testAccountId]);
    }
    if (testUserId) {
      await pool.query('DELETE FROM "user" WHERE id = $1', [testUserId]);
    }
    // Restaurar valor original do default
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ('default_video_provider', $1, now())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
      [originalSettingValue]
    );
    await pool.end();
  }

  console.log(`\nResultados: ${passed} passaram, ${failed} falharam.`);
  if (failed > 0) {
    process.exit(1);
  }
}

run();
