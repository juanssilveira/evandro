import * as dotenv from "dotenv";
import * as path from "node:path";
import { neon } from "@neondatabase/serverless";
import Mux from "@mux/mux-node";

const rootDir = process.cwd();
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config({ path: path.join(rootDir, ".env") });

const isDryRun = process.argv.includes("--dry-run");

async function runMigration() {
  console.log("=== WATCHMAP — RESTORE PUBLIC MUX PLAYBACK MIGRATION ===");
  if (isDryRun) {
    console.log(">>> DRY-RUN MODE: No changes will be persisted to DB or Mux. <<<\n");
  } else {
    console.log(">>> LIVE EXECUTION MODE <<<\n");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERRO: DATABASE_URL não configurada.");
    process.exit(1);
  }

  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    console.error("ERRO: Credenciais MUX_TOKEN_ID / MUX_TOKEN_SECRET ausentes.");
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const mux = new Mux({ tokenId, tokenSecret });

  // 1. Fetch all videos with mux_asset_id
  const videoRows = await sql`
    SELECT id, public_id, title, mux_asset_id, mux_playback_id, status
    FROM videos
    WHERE mux_asset_id IS NOT NULL
    ORDER BY created_at ASC
  `;

  console.log(`Encontrados ${videoRows.length} vídeos com Mux Asset no banco de dados.\n`);

  let totalProcessed = 0;
  let totalMigrated = 0;
  let totalErrors = 0;

  for (const video of videoRows) {
    totalProcessed++;
    const { id: videoId, title, mux_asset_id: assetId, mux_playback_id: currentPlaybackId } = video;
    console.log(`[${totalProcessed}/${videoRows.length}] Processando vídeo: "${title}" (ID: ${videoId}, Asset: ${assetId})`);

    try {
      // 1. Retrieve Mux Asset
      let asset;
      try {
        asset = await mux.video.assets.retrieve(assetId);
      } catch (assetErr) {
        console.error(`  [ERRO] Falha ao consultar Asset ${assetId} no Mux:`, assetErr?.message || assetErr);
        totalErrors++;
        continue;
      }

      if (!asset) {
        console.error(`  [ERRO] Asset ${assetId} não encontrado no Mux.`);
        totalErrors++;
        continue;
      }

      const playbackIds = asset.playback_ids || [];
      const publicIds = playbackIds.filter((p) => p.policy === "public");
      const signedIds = playbackIds.filter((p) => p.policy === "signed");

      console.log(`  Playback IDs no Mux: ${publicIds.length} public, ${signedIds.length} signed.`);

      let targetPublicPlaybackId = publicIds[0]?.id || null;

      // 2. Create public Playback ID if none exists
      if (!targetPublicPlaybackId) {
        if (isDryRun) {
          console.log(`  [DRY-RUN] Criaria public Playback ID para Asset ${assetId}.`);
          targetPublicPlaybackId = "dry_run_public_id";
        } else {
          console.log(`  Criando novo public Playback ID no Mux...`);
          const newPb = await mux.video.assets.createPlaybackId(assetId, {
            policy: "public",
          });
          targetPublicPlaybackId = newPb.id;
          console.log(`  Novo public Playback ID criado: ${targetPublicPlaybackId}`);
        }
      } else {
        console.log(`  Public Playback ID já existente: ${targetPublicPlaybackId}`);
      }

      // 3. Persist public Playback ID in database
      if (currentPlaybackId !== targetPublicPlaybackId) {
        if (isDryRun) {
          console.log(`  [DRY-RUN] Atualizaria mux_playback_id no DB de ${currentPlaybackId} para ${targetPublicPlaybackId}.`);
        } else {
          console.log(`  Persistindo public Playback ID no DB...`);
          const updateRes = await sql`
            UPDATE videos
            SET mux_playback_id = ${targetPublicPlaybackId}, updated_at = NOW()
            WHERE id = ${videoId}
            RETURNING id, mux_playback_id
          `;

          if (updateRes.length === 0 || updateRes[0].mux_playback_id !== targetPublicPlaybackId) {
            throw new Error(`Falha ao confirmar persistência no DB para vídeo ${videoId}`);
          }
          console.log(`  Persistência no DB confirmada com sucesso.`);
        }
      } else {
        console.log(`  DB já contém o public Playback ID correto.`);
      }

      // 4. Safe Order: Only delete signed Playback IDs AFTER public ID is created and saved
      if (signedIds.length > 0) {
        for (const signed of signedIds) {
          if (isDryRun) {
            console.log(`  [DRY-RUN] Removeria signed Playback ID ${signed.id} do Mux.`);
          } else {
            console.log(`  Removendo signed Playback ID ${signed.id} do Mux...`);
            await mux.video.assets.deletePlaybackId(assetId, signed.id);
            console.log(`  Signed Playback ID ${signed.id} removido.`);
          }
        }

        // 5. Confirm absence of signed Playback IDs
        if (!isDryRun) {
          const reloadedAsset = await mux.video.assets.retrieve(assetId);
          const remainingSigned = (reloadedAsset.playback_ids || []).filter((p) => p.policy === "signed");
          if (remainingSigned.length > 0) {
            throw new Error(`Asset ${assetId} ainda possui ${remainingSigned.length} Playback IDs signed.`);
          }
          console.log(`  Confirmação: Nenhum Playback ID signed restante no Asset.`);
        }
      } else {
        console.log(`  Nenhum Playback ID signed pendente de remoção.`);
      }

      totalMigrated++;
      console.log(`  [OK] Vídeo migrado/validado para public com sucesso.\n`);
    } catch (err) {
      console.error(`  [ERRO] Falha ao processar vídeo ${videoId}:`, err?.message || err, "\n");
      totalErrors++;
    }
  }

  console.log("==================================================");
  console.log(`MIGRAÇÃO CONCLUÍDA:`);
  console.log(`  Total Processados: ${totalProcessed}`);
  console.log(`  Migrados/OK: ${totalMigrated}`);
  console.log(`  Erros: ${totalErrors}`);
  console.log("==================================================");

  if (totalErrors > 0) {
    process.exit(1);
  }
}

runMigration().catch((err) => {
  console.error("Falha fatal na execução da migração:", err);
  process.exit(1);
});
